import type {
  ZenDecision,
  ZenEngineHandlerRequest,
  ZenEngineHandlerResponse,
  ZenEngineOptions,
  ZenEvaluateOptions,
} from '@gorules/zen-engine';
import { ZenDecisionContent, ZenEngine, evaluateExpressionSync } from '@gorules/zen-engine';
import { createHash } from 'node:crypto';

import { type CircuitBreaker } from './breaker.ts';
import { type CacheMetricsSnapshot, DecisionCache } from './decision-cache.ts';
import { EXEC_CONTEXT_INPUT_KEY, type ExecContext, getExecContext, runWithExecContext } from './exec-context.ts';
import { type ConcurrencyLimiter } from './limiter.ts';
import { type UdfRegistry, type UdfSemantics, globalUdfRegistry } from './register.ts';

const CUSTOM_HANDLER_META = '__meta__';

interface ExprAstItem {
  id: string;
  key: string;
  value: string | string[];
}

/** UDF 函数粒度执行轨迹（执行规范 §6.6）：经 customHandler 的 traceData 下发 */
export interface UdfTrace {
  /** 表达式实例 key（customNode 输出字段） */
  key: string;
  name: string;
  micros: number;
  /** 违例/异常码：INVALID_PARAM / UDF_TIMEOUT / INVALID_RESULT / UDF_NOT_FOUND / UDF_ERROR / REPLAYED / REPLAY_JOURNAL_MISS / CIRCUIT_OPEN */
  code?: string;
  issues?: string[];
  /** 算子语义（Y1） */
  semantics?: UdfSemantics;
  /** UDF 返回值快照（Y2 审计 journal 依据；错误路径为结构化错误对象） */
  outcome?: unknown;
}

interface EvaluateResponse {
  performance: string;
  result: unknown;
  trace?: unknown;
}

/** DecisionRuntime 构造项：zen-engine 原生 options + 实例级 UDF 注册表 + L1 缓存配置 */
export interface DecisionRuntimeOptions extends ZenEngineOptions {
  /** 缺省回落 globalUdfRegistry（配合 `@republicroad/zen-udf` 根导入的 reference 装载） */
  registry?: UdfRegistry;
  /** L1 决策缓存容量（条目数），缺省 500 */
  cacheCapacity?: number;
  /** 缓存指标 sink（verdict 接 Prometheus 用），每次读写后回调快照 */
  metricsSink?: (snapshot: CacheMetricsSnapshot) => void;
  /** per-tenant 并发闸（执行规范 §6.3）；缺省不限并发 */
  limiter?: ConcurrencyLimiter;
  /** 熔断器（Y5）：per tenantId+udfName 故障隔离；缺省无熔断 */
  breaker?: CircuitBreaker;
  /**
   * 返回值契约档位（执行规范 §6.5，宿主裁决 D5）：缺省 `warn`——违例计入 traceData、
   * 结果原样下发；`enforce` 把违例结果替换为 INVALID_RESULT 结构化错误。
   */
  resultValidation?: 'off' | 'warn' | 'enforce';
  /** UDF 错误消息脱敏器（执行规范 §6.7）；缺省内置规则（路径/敏感环境值替换为占位） */
  sanitizer?: (message: string) => string;
  /** 决策审计事件 sink（Y2）：evaluate 完成后回调；持久化属宿主。配置后 evaluate 内部强制开启 trace */
  onDecision?: (event: DecisionAuditEvent) => void;
}

/** 单个 UDF 的观测记录（Y2 审计事件 observed 数组项） */
export interface DecisionObservedCall {
  key: string;
  name: string;
  semantics: UdfSemantics;
  /** 返回值快照（含结构化错误对象——journal 回放依据） */
  outcome: unknown;
  micros: number;
}

/**
 * 决策审计事件（Y2）：决策完成时经 onDecision 下发，持久化属宿主。
 * inputHash = sha256(JSON.stringify(input))——数据最小化；原文存储属宿主策略。
 * observed 含 query/observe/act 全部 UDF 返回值快照，是 Y3 回放 journal 的来源。
 */
export interface DecisionAuditEvent {
  decisionId: string;
  tenantId: string;
  key: string;
  rev: string;
  inputHash: string;
  /** 完整决策结论（宿主裁决 D11） */
  output: unknown;
  /** 事件时间（ExecContext.eventTime；缺省 = 处理时间） */
  asOf?: string;
  processingTime: string;
  requestId?: string;
  source: 'live' | 'replay';
  observed: DecisionObservedCall[];
  performance?: string;
}

interface GraphNode {
  type?: string;
  name?: string;
  content?: {
    config?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

interface GraphContent {
  id?: string;
  metadata?: Record<string, unknown>;
  nodes: GraphNode[];
  [key: string]: unknown;
}

function evaluateExpressionSafe(expr: string, input?: unknown): unknown {
  try {
    return evaluateExpressionSync(expr, input);
  } catch {
    return null;
  }
}

/** 内置脱敏规则（执行规范 §6.7）：绝对路径占位 + 敏感名环境变量值替换为 [ENV_NAME] */
const sanitizeErrorDefault = (message: string): string => {
  let out = message.replace(/(?:[A-Za-z]:)?(?:[/\\][^\s'"`]+)+/g, '[path]');
  for (const [name, value] of Object.entries(process.env)) {
    if (/(secret|token|password|key|credential)/i.test(name) && value && value.length >= 4) {
      out = out.split(value).join(`[${name.toUpperCase()}]`);
    }
  }
  return out;
};

class DecisionRuntime {
  static CUSTOM_HANDLER_META = CUSTOM_HANDLER_META;

  engine: ZenEngine;
  options: DecisionRuntimeOptions;
  /** 实例级 UDF 注册表（缺省回落 globalUdfRegistry；多实例互不污染） */
  registry: UdfRegistry;
  /** L1 决策缓存（键含租户与 rev，见 docs/design/zen-udf-multi-tenant.md §3） */
  cache: DecisionCache;
  /** per-tenant 并发闸（缺省 undefined = 不限并发） */
  limiter?: ConcurrencyLimiter;
  /** 熔断器（缺省 undefined = 不熔断） */
  breaker?: CircuitBreaker;
  /** 返回值契约档位（缺省 warn，宿主裁决 D5） */
  resultValidation: 'off' | 'warn' | 'enforce';
  /** 错误消息脱敏器 */
  sanitizer: (message: string) => string;
  /** 决策审计事件 sink（缺省 undefined = 不出审计事件） */
  onDecision?: (event: DecisionAuditEvent) => void;

  constructor(options: DecisionRuntimeOptions = {}) {
    this.registry = options.registry ?? globalUdfRegistry;
    this.cache = new DecisionCache({ capacity: options.cacheCapacity, metricsSink: options.metricsSink });
    this.limiter = options.limiter;
    this.breaker = options.breaker;
    this.resultValidation = options.resultValidation ?? 'warn';
    this.sanitizer = options.sanitizer ?? sanitizeErrorDefault;
    this.onDecision = options.onDecision;
    if (options.customHandler == null) {
      options.customHandler = (request) => this.handleCustomNode(request);
    }
    this.options = options;
    this.engine = new ZenEngine(this.options);
  }

  createDecision(content: string | object): ZenDecision {
    const contentObj = typeof content === 'string' ? JSON.parse(content) : content;
    const enhanced = this.graphAddons(contentObj);
    const decisionContent = new ZenDecisionContent(enhanced);
    return this.engine.createDecision(decisionContent);
  }

  /**
   * L1 缓存键：`${tenantId}:${key}@${rev}`——不可变版本键，与 verdict `modelId:v{rev}` 对齐。
   * tenantExempt 时租户段为 'single'；无任何租户上下文时拒绝（fail closed）。
   */
  private composeCacheKey(key: string, rev?: string): string {
    const ctx = getExecContext();
    const tenant = ctx?.tenantId ?? (ctx?.tenantExempt ? 'single' : '');
    if (!tenant) {
      throw new Error('[zen-udf] cache operations require exec context tenantId (or tenantExempt)');
    }
    return tenant + ':' + key + '@' + (rev ?? 'latest');
  }

  private buildAndCache(cacheKey: string, content: string | object): ZenDecision {
    const startedAt = this.cache.markBuildStart();
    const decision = this.createDecision(content);
    this.cache.markBuildEnd(startedAt);
    this.cache.set(cacheKey, { decision, content });
    return decision;
  }

  createDecisionWithCacheKey(key: string, content: string | object, rev?: string): ZenDecision {
    const cacheKey = this.composeCacheKey(key, rev);
    if (this.cache.has(cacheKey)) {
      throw new Error(
        'rule key:' + key + ' is existed, if confirm to overwrite this key, please use updateDecisionWithCacheKey',
      );
    }
    return this.buildAndCache(cacheKey, content);
  }

  updateDecisionWithCacheKey(key: string, content: string | object, rev?: string): ZenDecision {
    const cacheKey = this.composeCacheKey(key, rev);
    if (!this.cache.has(cacheKey)) {
      throw new Error('rule key:' + key + ' is not existed, please use createDecisionWithCacheKey');
    }
    return this.buildAndCache(cacheKey, content);
  }

  deleteDecisionWithCacheKey(key: string, rev?: string): void {
    const cacheKey = this.composeCacheKey(key, rev);
    if (!this.cache.has(cacheKey)) {
      throw new Error('delete failed! rule key:' + key + ' is not existed');
    }
    this.cache.delete(cacheKey);
  }

  getDecision(key: string, rev?: string): ZenDecision {
    const cacheKey = this.composeCacheKey(key, rev);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.decision;
    }
    const loader = this.options.loader;
    // zen-engine 2.0：loader 为「函数 | static/fs/zip 对象」四形联合——本仓仅支持同步函数形态
    if (typeof loader !== 'function') {
      throw new Error('decision ' + key + ' not found, please use createDecisionWithCacheKey');
    }
    const decisionContent = loader(key);
    if (decisionContent instanceof Promise) {
      throw new Error('loader returned a Promise; only sync loaders are supported for now');
    }
    const startedAt = this.cache.markBuildStart();
    const decision = this.createDecision(decisionContent);
    this.cache.markBuildEnd(startedAt);
    this.cache.set(cacheKey, { decision, content: decisionContent });
    return decision;
  }

  getDecisionCache(key: string, rev?: string): ZenDecision | undefined {
    return this.cache.get(this.composeCacheKey(key, rev))?.decision;
  }

  getContentCache(key: string, rev?: string): unknown {
    return this.cache.get(this.composeCacheKey(key, rev))?.content;
  }

  /**
   * 多租户安全默认（fail closed）：evaluate 入口强制租户上下文。
   * 单租户 CLI/本地场景在 ExecContext 设 tenantExempt: true 显式豁免。
   */
  private static requireTenantContext(): void {
    const ctx = getExecContext();
    if (ctx?.tenantExempt) return;
    if (!ctx?.tenantId) {
      throw new Error(
        '[zen-udf] missing exec context tenantId — wrap the call in runWithExecContext({ tenantId }, fn), or set tenantExempt: true for single-tenant deployments',
      );
    }
  }

  /**
   * ALS 不跨 zen-engine 的 Rust worker → TSFN 回调边界存活（探针实证），
   * 把当前 ExecContext 以保留键嵌入输入对象，由 handleCustomNode 提取后
   * 重建立上下文。仅对象输入可承载；其余形态按无上下文执行（UDF 内 fail closed）。
   * 嵌入的是冻结副本：防图表达式篡改调用方持有的共享 ctx 对象（加固 §5）。
   */
  private static enrichInputWithExecContext(ctx: unknown): unknown {
    if (ctx === null || typeof ctx !== 'object' || Array.isArray(ctx)) {
      return ctx;
    }
    const execCtx = getExecContext();
    if (!execCtx) {
      return ctx;
    }
    return { ...(ctx as Record<string, unknown>), [EXEC_CONTEXT_INPUT_KEY]: Object.freeze({ ...execCtx }) };
  }

  /**
   * 审计事件（Y2）：配置 onDecision 后，evaluate 内部强制开启 trace，
   * 从节点 traceData 收集 observed（含各 UDF 返回值快照），构造 DecisionAuditEvent 下发。
   * sink 异常不中断决策（仅 console.error）。
   */
  private emitAudit(
    execCtx: ExecContext | undefined,
    key: string,
    rev: string | undefined,
    rawInput: unknown,
    result: EvaluateResponse,
  ): void {
    if (!this.onDecision) return;
    try {
      const observed: DecisionObservedCall[] = [];
      const trace = result.trace as
        | Record<string, { traceData?: { udf?: Array<UdfTrace & { outcome?: unknown; semantics?: UdfSemantics }> } }>
        | undefined;
      for (const nodeTrace of Object.values(trace ?? {})) {
        for (const t of nodeTrace?.traceData?.udf ?? []) {
          observed.push({
            key: t.key,
            name: t.name,
            semantics: t.semantics ?? 'query',
            outcome: t.outcome,
            micros: t.micros,
          });
        }
      }
      const event: DecisionAuditEvent = {
        decisionId: execCtx?.decisionId ?? globalThis.crypto?.randomUUID?.() ?? `dec-${Date.now()}-${Math.random()}`,
        tenantId: execCtx?.tenantId ?? 'single',
        key,
        rev: rev ?? 'latest',
        inputHash: createHash('sha256').update(JSON.stringify(rawInput)).digest('hex'),
        output: result.result,
        asOf: execCtx?.eventTime,
        processingTime: new Date().toISOString(),
        requestId: execCtx?.requestId,
        source: execCtx?.replay ? 'replay' : 'live',
        observed,
        performance: result.performance,
      };
      this.onDecision(event);
    } catch (sinkError) {
      console.error(
        '[zen-udf] onDecision sink failed:',
        sinkError instanceof Error ? sinkError.message : String(sinkError),
      );
    }
  }

  evaluate(key: string, ctx: unknown, options?: unknown, rev?: string): Promise<EvaluateResponse> {
    return this.evaluateAsync(key, ctx, options, rev);
  }

  async evaluateAsync(key: string, ctx: unknown, options?: unknown, rev?: string): Promise<EvaluateResponse> {
    DecisionRuntime.requireTenantContext();
    const decision = this.getDecision(key, rev);
    const execCtx = getExecContext();
    // Y2：配置 onDecision 时强制 trace（observed 从节点 traceData 收集）
    const evalOpts =
      this.onDecision != null
        ? ({ ...(options as Record<string, unknown> | undefined), trace: true } as ZenEvaluateOptions)
        : (options as ZenEvaluateOptions | null | undefined);
    const result = (await decision.evaluate(
      DecisionRuntime.enrichInputWithExecContext(ctx),
      evalOpts,
    )) as EvaluateResponse;
    this.emitAudit(execCtx, key, rev, ctx, result);
    return result;
  }

  /**
   * 确定性回放（Y3）：从审计事件构造 replay 上下文重演决策。
   * - observe/act：不重执行，读 journal 中钉住的当时返回值
   * - query：以 asOf 为时钟正常执行
   * - 输入校验：sha256(input) 必须匹配审计 inputHash，否则抛错（trust 语义）
   * 回放本身也会产生一条 source: 'replay' 的审计事件。
   */
  async evaluateReplay(
    audit: DecisionAuditEvent,
    input: unknown,
    options?: ZenEvaluateOptions,
  ): Promise<EvaluateResponse> {
    const inputHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    if (inputHash !== audit.inputHash) {
      throw new Error(
        `[zen-udf] replay input hash mismatch — supplied input (\`${inputHash.slice(0, 12)}\`) does not match the audited decision (\`${audit.inputHash.slice(0, 12)}\`)`,
      );
    }
    const execCtx: ExecContext = {
      tenantId: audit.tenantId,
      requestId: audit.requestId,
      decisionId: audit.decisionId,
      eventTime: audit.asOf,
      replay: {
        decisionId: audit.decisionId,
        asOf: audit.asOf ?? audit.processingTime,
        journal: audit.observed.map((o) => ({ key: o.key, name: o.name, outcome: o.outcome })),
      },
    };
    return runWithExecContext(execCtx, () =>
      this.evaluateAsync(audit.key, input, options, audit.rev === 'latest' ? undefined : audit.rev),
    );
  }

  graphAddons(content: GraphContent): object {
    const ruleGraph = JSON.parse(JSON.stringify(content)) as GraphContent;

    if (!ruleGraph.id) {
      ruleGraph.id =
        typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `decision-${Date.now()}`;
    }

    const inputNodeName =
      ruleGraph.nodes
        .filter((n) => n.type === 'inputNode')
        .map((n) => n.name)
        .filter(Boolean)[0] ?? '';

    const ruleId = ruleGraph.id ?? '';
    const ruleMeta = ruleGraph.metadata ?? {};
    (ruleMeta as Record<string, unknown>)['namespace'] = ruleId;
    (ruleMeta as Record<string, unknown>)['inputNode_name'] = inputNodeName;

    for (const node of ruleGraph.nodes) {
      if (node.type !== 'customNode') continue;
      const config = (node.content?.config ?? {}) as Record<string, unknown>;

      const chMeta = ((config[CUSTOM_HANDLER_META] as Record<string, unknown>) ??
        (config['meta'] as Record<string, unknown>) ??
        {}) as Record<string, unknown>;
      Object.assign(chMeta, ruleMeta);
      config[CUSTOM_HANDLER_META] = chMeta;

      if (config['passThrough'] == null) {
        config['passThrough'] = true;
      }

      const customExpressions = config['expressions'] as ExprAstItem[] | undefined;
      if (customExpressions) {
        const exprAsts: ExprAstItem[] = [];
        for (const funcItem of customExpressions) {
          const item = { ...funcItem };
          item.value = DecisionRuntime.parseOperatorExpr(funcItem.value);
          exprAsts.push(item);
        }
        config['expr_asts'] = exprAsts;
      }
    }

    return ruleGraph;
  }

  static parseOperatorExpr(expr: string | string[]): string[] {
    if (Array.isArray(expr)) {
      return expr;
    }
    const pattern = /;;(?=(?:[^"'`]*["'`][^"'`]*["'`])*[^"'`]*$)/;
    const parts = expr.split(pattern).map((s) => s.trim());
    return parts;
  }

  /** customNode 执行器（实例绑定：经 this.registry 解析 UDF，多运行时互不串扰） */
  private async handleCustomNode(request: ZenEngineHandlerRequest): Promise<ZenEngineHandlerResponse> {
    const node = request.node;
    const exprAsts = (node.config?.['expr_asts'] ?? []) as ExprAstItem[];
    const inputField = (node.config?.['inputField'] as string | null) ?? null;
    const outputPath = (node.config?.['outputPath'] as string | null) ?? null;
    const passThrough = (node.config?.['passThrough'] as boolean | null) ?? null;
    const meta = (node.config?.[CUSTOM_HANDLER_META] as Record<string, unknown>) ?? {};

    // ExecContext 重建立：ALS 不跨 TSFN 边界，从嵌入输入的保留键恢复（见 evaluate）
    const rawInput = (request.input ?? {}) as Record<string, unknown>;
    const execCtx = rawInput[EXEC_CONTEXT_INPUT_KEY] as ExecContext | undefined;

    const context: Record<string, unknown> = {
      node_id: node.id,
      [CUSTOM_HANDLER_META]: meta,
      passThrough,
      inputField,
      outputPath,
    };

    const execute = async (): Promise<ZenEngineHandlerResponse> => {
      // 执行规范 §6.6：UDF 函数粒度轨迹（经 traceData 下发，simulator/verdict 审计共用）
      const traces: UdfTrace[] = [];
      const coroFuncs = exprAsts.map((item) => this.executeExpr(item, request.input, context, traces));
      const resultsArr = await Promise.all(coroFuncs);
      const results: Record<string, unknown> = {};
      exprAsts.forEach((item, i) => {
        results[item.key] = resultsArr[i];
      });

      if (passThrough && typeof request.input === 'object' && request.input !== null) {
        const input = request.input as Record<string, unknown>;
        for (const key of Object.keys(input)) {
          if (key !== '$nodes' && key !== EXEC_CONTEXT_INPUT_KEY) {
            results[key] = input[key];
          }
        }
      }

      if (outputPath) {
        const tmp = evaluateExpressionSafe(`${outputPath}=_`, { _: results }) as Record<string, unknown> | undefined;
        if (tmp && typeof tmp === 'object') {
          Object.assign(results, tmp);
        }
      }

      return traces.length > 0 ? { output: results, traceData: { udf: traces } } : { output: results };
    };

    return execCtx ? runWithExecContext(execCtx, execute) : execute();
  }

  private async executeExpr(
    execExpr: ExprAstItem,
    nodeInput: unknown,
    context: Record<string, unknown>,
    traces: UdfTrace[],
  ): Promise<unknown> {
    let breakerKey: string | null = null;
    try {
      const exprId = execExpr.id;
      const exprAst = execExpr.value;

      const ast = Array.isArray(exprAst) ? exprAst : DecisionRuntime.parseOperatorExpr(exprAst);
      const funcName = ast[0] as string;
      const opArgExpressions = ast.slice(1);

      const inputField = context['inputField'] as string | null;
      const fSchema = this.registry.udfFunctionSchema(funcName);
      const semantics = (fSchema?.semantics as UdfSemantics | undefined) ?? 'query';

      // Y3 回放模式：observe/act 不重执行——从 ExecContext.replay.journal 读回当时返回值；
      // journal 缺失 fail closed（REPLAY_JOURNAL_MISS），query 类正常执行（时钟用 asOf）
      const replayCtx = getExecContext()?.replay;
      if (replayCtx && semantics !== 'query') {
        const entry = replayCtx.journal.find((j) => j.key === execExpr.key && j.name === funcName);
        if (!entry) {
          const missOutcome = {
            error: { code: 'REPLAY_JOURNAL_MISS', issues: [`no journaled outcome for ${funcName}`] },
          };
          traces.push({
            key: execExpr.key,
            name: funcName,
            micros: 0,
            code: 'REPLAY_JOURNAL_MISS',
            semantics,
            outcome: missOutcome,
          });
          return missOutcome;
        }
        traces.push({
          key: execExpr.key,
          name: funcName,
          micros: 0,
          code: 'REPLAYED',
          semantics,
          outcome: entry.outcome,
        });
        return entry.outcome;
      }

      if (fSchema) {
        const args = opArgExpressions.map((i: string) => {
          const expr = inputField ? `${inputField}.${i}` : i;
          return evaluateExpressionSafe(expr, nodeInput);
        });

        // 执行规范 §6.1：位置参数必填项前置校验
        const paramIssues = this.registry.validatePositionalArgs(funcName, args);
        if (paramIssues.length > 0) {
          const invalidParamOutcome = { error: { code: 'INVALID_PARAM', issues: paramIssues } };
          traces.push({
            key: execExpr.key,
            name: funcName,
            micros: 0,
            code: 'INVALID_PARAM',
            issues: paramIssues,
            semantics,
            outcome: invalidParamOutcome,
          });
          return invalidParamOutcome;
        }

        const operatorKwargs = this.registry.funcBindParams(funcName, args);
        const kwargs: Record<string, unknown> = {
          ...operatorKwargs,
          ...context,
          func_id: exprId,
          expr_id: exprId,
          _node_input_: nodeInput,
        };

        // 执行规范 §6.3：per-tenant 并发闸（注入 limiter 时生效）
        const tenantId = getExecContext()?.tenantId;
        // Y5：熔断检查（per tenantId+udfName），打开时 CIRCUIT_OPEN 快速失败
        breakerKey = tenantId ? `${tenantId}:${funcName}` : funcName;
        if (this.breaker && !this.breaker.allow(breakerKey)) {
          const openOutcome = { error: { code: 'CIRCUIT_OPEN', message: `circuit open for ${breakerKey}` } };
          traces.push({
            key: execExpr.key,
            name: funcName,
            micros: 0,
            code: 'CIRCUIT_OPEN',
            semantics,
            outcome: openOutcome,
          });
          return openOutcome;
        }
        const release = this.limiter && tenantId ? await this.limiter.acquire(tenantId) : null;
        let result: unknown;
        const startedAt = process.hrtime.bigint();
        try {
          // 执行规范 §6.2：kwargs.timeout 约定（毫秒）——运行时级超时兜底，超时返回结构化错误
          const timeoutMs = typeof kwargs.timeout === 'number' && kwargs.timeout > 0 ? kwargs.timeout : null;
          const call = this.registry.call(funcName, kwargs);
          result = timeoutMs
            ? await Promise.race([
                call,
                new Promise((_resolve, reject) =>
                  setTimeout(() => reject(new Error('udf timeout after ' + timeoutMs + 'ms')), timeoutMs),
                ),
              ])
            : await call;
          this.breaker?.recordSuccess(breakerKey);
        } catch (timeoutError) {
          this.breaker?.recordFailure(breakerKey);
          const message = timeoutError instanceof Error ? timeoutError.message : String(timeoutError);
          if (message.includes('udf timeout')) {
            const timeoutOutcome = { error: { code: 'UDF_TIMEOUT', message } };
            traces.push({
              key: execExpr.key,
              name: funcName,
              micros: 0,
              code: 'UDF_TIMEOUT',
              semantics,
              outcome: timeoutOutcome,
            });
            return timeoutOutcome;
          }
          throw timeoutError;
        } finally {
          release?.();
        }
        const micros = Number(process.hrtime.bigint() - startedAt) / 1000;

        // 执行规范 §6.5：返回值契约（缺省 warn——只记账不改行为；enforce 换成结构化错误）
        if (this.resultValidation !== 'off') {
          const resultIssues = this.registry.validateResult(funcName, result);
          if (resultIssues.length > 0) {
            traces.push({
              key: execExpr.key,
              name: funcName,
              micros,
              code: 'INVALID_RESULT',
              issues: resultIssues,
              semantics,
              outcome: result,
            });
            if (this.resultValidation === 'enforce') {
              return { error: { code: 'INVALID_RESULT', issues: resultIssues } };
            }
          }
        }

        traces.push({ key: execExpr.key, name: funcName, micros, semantics, outcome: result });
        return result;
      } else {
        if (funcName) {
          const notFoundOutcome = { error: `udf ${funcName} not found` };
          traces.push({
            key: execExpr.key,
            name: funcName,
            micros: 0,
            code: 'UDF_NOT_FOUND',
            semantics,
            outcome: notFoundOutcome,
          });
          return notFoundOutcome;
        }
        const emptyOutcome = { error: 'empty udf name not allowed' };
        traces.push({ key: execExpr.key, name: '', micros: 0, code: 'UDF_NOT_FOUND', outcome: emptyOutcome });
        return emptyOutcome;
      }
    } catch (error) {
      // UDF 抛错不下发为 null(否则 simulator 无痕吞错)：以结构化错误对象出现在 trace/输出中
      if (breakerKey) this.breaker?.recordFailure(breakerKey);
      const errorOutcome = { error: this.sanitizer(error instanceof Error ? error.message : String(error)) };
      traces.push({ key: execExpr.key, name: '', micros: 0, code: 'UDF_ERROR', outcome: errorOutcome });
      return errorOutcome;
    }
  }

  udfFunctionSchemaTools(): unknown[] {
    return this.registry.udfFunctionSchemaTools();
  }
}

export { DecisionRuntime };
