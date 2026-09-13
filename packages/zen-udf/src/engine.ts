import type {
  ZenDecision,
  ZenEngineHandlerRequest,
  ZenEngineHandlerResponse,
  ZenEngineOptions,
  ZenEvaluateOptions,
} from '@gorules/zen-engine';
import { ZenDecisionContent, ZenEngine, evaluateExpressionSync } from '@gorules/zen-engine';

import { type CacheMetricsSnapshot, DecisionCache } from './decision-cache.ts';
import { getExecContext } from './exec-context.ts';
import { type UdfRegistry, globalUdfRegistry } from './register.ts';

const CUSTOM_HANDLER_META = '__meta__';

interface ExprAstItem {
  id: string;
  key: string;
  value: string | string[];
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

class DecisionRuntime {
  static CUSTOM_HANDLER_META = CUSTOM_HANDLER_META;

  engine: ZenEngine;
  options: DecisionRuntimeOptions;
  /** 实例级 UDF 注册表（缺省回落 globalUdfRegistry；多实例互不污染） */
  registry: UdfRegistry;
  /** L1 决策缓存（键含租户与 rev，见 docs/design/zen-udf-multi-tenant.md §3） */
  cache: DecisionCache;

  constructor(options: DecisionRuntimeOptions = {}) {
    this.registry = options.registry ?? globalUdfRegistry;
    this.cache = new DecisionCache({ capacity: options.cacheCapacity, metricsSink: options.metricsSink });
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

  evaluate(key: string, ctx: unknown, options?: unknown, rev?: string): Promise<EvaluateResponse> {
    DecisionRuntime.requireTenantContext();
    const decision = this.getDecision(key, rev);
    return decision.evaluate(ctx, options as ZenEvaluateOptions | null | undefined) as Promise<EvaluateResponse>;
  }

  async evaluateAsync(key: string, ctx: unknown, options?: unknown, rev?: string): Promise<EvaluateResponse> {
    DecisionRuntime.requireTenantContext();
    const decision = this.getDecision(key, rev);
    const result = await decision.evaluate(ctx, options as ZenEvaluateOptions | null | undefined);
    return result as EvaluateResponse;
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

    const context: Record<string, unknown> = {
      node_id: node.id,
      [CUSTOM_HANDLER_META]: meta,
      passThrough,
      inputField,
      outputPath,
    };

    const coroFuncs = exprAsts.map((item) => this.executeExpr(item, request.input, context));
    const resultsArr = await Promise.all(coroFuncs);
    const results: Record<string, unknown> = {};
    exprAsts.forEach((item, i) => {
      results[item.key] = resultsArr[i];
    });

    if (passThrough && typeof request.input === 'object' && request.input !== null) {
      const input = request.input as Record<string, unknown>;
      for (const key of Object.keys(input)) {
        if (key !== '$nodes') {
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

    return { output: results };
  }

  private async executeExpr(
    execExpr: ExprAstItem,
    nodeInput: unknown,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const exprId = execExpr.id;
      const exprAst = execExpr.value;

      const ast = Array.isArray(exprAst) ? exprAst : DecisionRuntime.parseOperatorExpr(exprAst);
      const funcName = ast[0] as string;
      const opArgExpressions = ast.slice(1);

      const inputField = context['inputField'] as string | null;
      const fSchema = this.registry.udfFunctionSchema(funcName);

      if (fSchema) {
        const args = opArgExpressions.map((i: string) => {
          const expr = inputField ? `${inputField}.${i}` : i;
          return evaluateExpressionSafe(expr, nodeInput);
        });

        const operatorKwargs = this.registry.funcBindParams(funcName, args);
        const kwargs: Record<string, unknown> = {
          ...operatorKwargs,
          ...context,
          func_id: exprId,
          expr_id: exprId,
          _node_input_: nodeInput,
        };

        const result = await this.registry.call(funcName, kwargs);
        return result;
      } else {
        if (funcName) {
          return { error: `udf ${funcName} not found` };
        }
        return { error: 'empty udf name not allowed' };
      }
    } catch (error) {
      // UDF 抛错不下发为 null(否则 simulator 无痕吞错)：以结构化错误对象出现在 trace/输出中
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  udfFunctionSchemaTools(): unknown[] {
    return this.registry.udfFunctionSchemaTools();
  }
}

export { DecisionRuntime };
