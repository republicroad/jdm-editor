import { evaluateExpressionSync } from '@gorules/zen-engine';

import type { DecisionRuntime } from './engine.ts';
import type { ExecContext, ReplayJournalEntry } from './exec-context.ts';
import { runWithExecContext } from './exec-context.ts';

/**
 * 决策测试夹具运行器（Y7；ADR-014 executor 反转）：
 * runner 只认识执行器，不认识 runtime——执行、租户、回放、追踪全部留在
 * executor 侧（服务端适配器 = createRuntimeExecutor；浏览器/mock = 宿主自造）。
 * runner 职责收敛为：迭代/并发、断言匹配、报告装配、进度回调，零引擎依赖。
 * fixtures 形状是跨仓交换物（CONTRACT.md §10 测试契约）。
 */

export type Expectation =
  | { mode: 'deep'; value: unknown }
  | { mode: 'path'; path: string; value: unknown }
  /** 可序列化断言：zen-expression 对结果求值（根绑定 result，ADR-014 OQ3） */
  | { mode: 'expression'; source: string }
  /** 进程内便利糖：携带函数体不可跨端序列化，不入 CONTRACT 测试侧契约 */
  | { mode: 'predicate'; test: (result: unknown) => boolean };

export interface DecisionFixture {
  name: string;
  input: unknown;
  /** 事件时间（可选）：query 类算子的 asOf 时钟 */
  asOf?: string;
  /** observe/act 桩（来自历史审计 journal）：提供时进入回放语义 */
  journal?: ReplayJournalEntry[];
  /** 缺省 = smoke 语义：passed = 执行无异常（ADR-014 §2，NamedExample 的接入形态） */
  expect?: Expectation;
}

export type FixtureOutcome = 'passed' | 'assertion-failed' | 'execution-error';

export interface FixtureResult {
  name: string;
  /** 聚合值（passed/failed 计数），向后兼容保留 */
  passed: boolean;
  /** 断言失败与执行错误分家（结果矩阵可读性） */
  outcome: FixtureOutcome;
  actual?: unknown;
  error?: string;
  /** 结果矩阵列：耗时 */
  durationMs?: number;
  /** 结果矩阵列：命中节点 id（executor 上报） */
  traceHits?: string[];
}

export interface FixtureReport {
  passed: number;
  failed: number;
  results: FixtureResult[];
}

/** 执行器契约（CONTRACT §10）：一段「给定夹具，产出一次执行结果」的能力 */
export type DecisionTestExecutor = (
  fixture: DecisionFixture,
  index: number,
) => Promise<{
  result?: unknown;
  error?: string;
  durationMs?: number;
  traceHits?: string[];
}>;

/** expression 断言求值器（注入——runner 保持零引擎依赖） */
export type ExpressionEvaluator = (source: string, data: unknown) => boolean;

export interface RunDecisionTestsOptions {
  executor: DecisionTestExecutor;
  fixtures: DecisionFixture[];
  /** 缺省 1——act 类算子有副作用，并发是显式选择 */
  concurrency?: number;
  onProgress?: (result: FixtureResult, index: number, total: number) => void;
  /** 缺省遇 expression 断言 → assertion-failed（error 注明缺求值器） */
  expressionEvaluator?: ExpressionEvaluator;
}

const readPath = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, segment) => {
    if (acc !== null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (k) =>
      k in (b as Record<string, unknown>) &&
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
};

const matches = (
  result: unknown,
  expect: Expectation,
  evaluator: ExpressionEvaluator | undefined,
): { passed: boolean; error?: string } => {
  switch (expect.mode) {
    case 'deep':
      return { passed: deepEqual(result ?? null, expect.value ?? null) };
    case 'path':
      return { passed: deepEqual(readPath(result, expect.path) ?? null, expect.value ?? null) };
    case 'predicate':
      return { passed: expect.test(result) === true };
    case 'expression': {
      if (!evaluator) {
        return { passed: false, error: 'expression assertion requires expressionEvaluator' };
      }
      try {
        return { passed: evaluator(expect.source, result) === true };
      } catch (e) {
        return {
          passed: false,
          error: `expression evaluation failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }
    default:
      return { passed: false, error: 'expectation mismatch' };
  }
};

/** 运行全部夹具并返回报告（不抛异常，逐夹具记录；执行语义单源在 executor 侧） */
export async function runDecisionTests(options: RunDecisionTestsOptions): Promise<FixtureReport> {
  const { executor, fixtures, concurrency = 1, onProgress, expressionEvaluator } = options;
  const results: FixtureResult[] = new Array(fixtures.length);
  let cursor = 0;

  const runNext = async (): Promise<void> => {
    while (cursor < fixtures.length) {
      const index = cursor++;
      const fixture = fixtures[index]!;
      const startedAt = Date.now();
      let execution: Awaited<ReturnType<DecisionTestExecutor>>;
      try {
        execution = await executor(fixture, index);
      } catch (e) {
        execution = { error: e instanceof Error ? e.message : String(e) };
      }
      const durationMs = execution.durationMs ?? Date.now() - startedAt;

      let result: FixtureResult;
      if (execution.error) {
        result = {
          name: fixture.name,
          passed: false,
          outcome: 'execution-error',
          error: execution.error,
          durationMs,
          traceHits: execution.traceHits,
        };
      } else if (fixture.expect) {
        const verdict = matches(execution.result, fixture.expect, expressionEvaluator);
        result = {
          name: fixture.name,
          passed: verdict.passed,
          outcome: verdict.passed ? 'passed' : 'assertion-failed',
          actual: execution.result,
          ...(verdict.passed ? {} : { error: verdict.error ?? 'expectation mismatch' }),
          durationMs,
          traceHits: execution.traceHits,
        };
      } else {
        result = {
          name: fixture.name,
          passed: true,
          outcome: 'passed',
          actual: execution.result,
          durationMs,
          traceHits: execution.traceHits,
        };
      }

      results[index] = result;
      onProgress?.(result, index, fixtures.length);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => runNext()));

  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}

/** 夹具专用键命名空间：不碰宿主服务键空间（隔离修复，ADR-014 问题 4） */
const FIXTURES_KEY_PREFIX = '__fixtures__:';

/** 服务端便利适配器：runtime 世界一行接入 executor 契约（现实现的执行侧原样迁入） */
export const createRuntimeExecutor = (
  runtime: DecisionRuntime,
  options: { key: string; model: string | object; rev?: string; tenantId?: string },
): DecisionTestExecutor => {
  const tenantId = options.tenantId ?? 'fixtures';
  const rev = options.rev ?? 'latest';
  const cacheKey = `${FIXTURES_KEY_PREFIX}${options.key}`;
  // promise memo：并发首跑只登记一次（闭包 boolean 有竞态窗口）
  let registration: Promise<void> | null = null;

  const ensureRegistered = (): Promise<void> => {
    registration ??= runWithExecContext({ tenantId }, async () => {
      try {
        runtime.createDecisionWithCacheKey(cacheKey, options.model, rev);
      } catch {
        runtime.updateDecisionWithCacheKey(cacheKey, options.model, rev);
      }
    });
    return registration;
  };

  return async (fixture) => {
    await ensureRegistered();
    const startedAt = Date.now();
    const execCtx: ExecContext = {
      tenantId,
      decisionId: `fixture:${fixture.name}`,
      ...(fixture.asOf ? { eventTime: fixture.asOf } : {}),
      ...(fixture.journal
        ? {
            replay: {
              decisionId: `fixture:${fixture.name}`,
              asOf: fixture.asOf ?? new Date().toISOString(),
              journal: fixture.journal,
            },
          }
        : {}),
    };
    // trace 开销是测试语义的一部分（traceHits 矩阵列）；与生产热路径的审计
    // 免 trace 化互不干扰（cbbbd347 解耦的是审计⇒trace，此处显式要 trace）
    const outcome = await runWithExecContext(execCtx, () =>
      runtime.evaluateAsync(cacheKey, fixture.input, { trace: true }, rev),
    );
    return {
      result: outcome.result,
      durationMs: Date.now() - startedAt,
      traceHits: Object.keys((outcome.trace ?? {}) as Record<string, unknown>),
    };
  };
};

/** Node 世界便利工厂：zen-expression 对结果求值（根绑定 result，ADR-014 OQ3） */
export const createZenExpressionEvaluator = (): ExpressionEvaluator => (source, data) =>
  evaluateExpressionSync(source, { result: data }) !== false;
