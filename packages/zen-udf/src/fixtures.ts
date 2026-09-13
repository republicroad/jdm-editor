import type { DecisionRuntime } from './engine.ts';
import { type ReplayJournalEntry, runWithExecContext } from './exec-context.ts';

/**
 * 决策测试夹具运行器（Y7）：verdict 模型登记页"发布前跑夹具"的执行引擎。
 * 基于 Y3 回放语义——journal 中的 observe/act 不重执行（读桩值），夹具可复现。
 */

export type Expectation =
  | { mode: 'deep'; value: unknown }
  | { mode: 'path'; path: string; value: unknown }
  | { mode: 'predicate'; test: (result: unknown) => boolean };

export interface DecisionFixture {
  name: string;
  input: unknown;
  /** 事件时间（可选）：query 类算子的 asOf 时钟 */
  asOf?: string;
  /** observe/act 桩（来自历史审计 journal）：提供时进入回放语义 */
  journal?: ReplayJournalEntry[];
  expect: Expectation;
}

export interface FixtureResult {
  name: string;
  passed: boolean;
  actual?: unknown;
  error?: string;
}

export interface FixtureReport {
  passed: number;
  failed: number;
  results: FixtureResult[];
}

export interface RunDecisionTestsOptions {
  /** 夹具执行租户（缺省 'fixtures'） */
  tenantId?: string;
  /** 模型 rev（缺省 'latest'） */
  rev?: string;
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

const matches = (result: unknown, expect: Expectation): boolean => {
  switch (expect.mode) {
    case 'deep':
      return deepEqual(result ?? null, expect.value ?? null);
    case 'path':
      return deepEqual(readPath(result, expect.path) ?? null, expect.value ?? null);
    case 'predicate':
      return expect.test(result);
    default:
      return false;
  }
};

export interface RunDecisionTestsOptionsWithModel extends RunDecisionTestsOptions {
  /** 登记待测模型（key@rev） */
  model: string | object;
  key: string;
  fixtures: DecisionFixture[];
}

/** 在 runtime 上登记模型并运行全部夹具，返回报告（不抛异常，逐夹具记录） */
export async function runDecisionTests(
  runtime: DecisionRuntime,
  options: RunDecisionTestsOptionsWithModel,
): Promise<FixtureReport> {
  const tenantId = options.tenantId ?? 'fixtures';
  const rev = options.rev ?? 'latest';
  const results: FixtureResult[] = [];

  await runWithExecContext({ tenantId }, async () => {
    try {
      runtime.createDecisionWithCacheKey(options.key, options.model, rev);
    } catch {
      runtime.updateDecisionWithCacheKey(options.key, options.model, rev);
    }
  });

  for (const fixture of options.fixtures) {
    const result: FixtureResult = { name: fixture.name, passed: false };
    try {
      const execCtx = {
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
      const outcome = await runWithExecContext(execCtx, () =>
        runtime.evaluateAsync(options.key, fixture.input, undefined, rev),
      );
      result.actual = outcome.result;
      result.passed = matches(outcome.result, fixture.expect);
      if (!result.passed) {
        result.error = 'expectation mismatch';
      }
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
    }
    results.push(result);
  }

  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
