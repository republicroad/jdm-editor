import type { ContractFixture, DecisionGraphType, ExampleRunReport, FixturesRunner } from '@republicroad/jdm-editor';
import { runDecisionTests } from '@republicroad/zen-udf/runner';

import type { SimulateHandler } from './types';

/**
 * ADR-013 批次三 / ADR-014：simulateHandler → fixturesRunner 适配器（参考实现）。
 *
 * kernel 的 Run all 槽位由本适配器注入：每个 example 经 simulateHandler 跑整图
 * （执行语义与模拟器单源——宿主服务端引擎），报告由 zen-udf 0.13.0 的
 * runDecisionTests 装配（字面复用，勿新写 runner）。smoke 语义：examples 无
 * expect，passed = 执行无异常；Simulation.error → execution-error。
 */
export const createSimulateFixturesRunner = (simulateHandler: SimulateHandler): FixturesRunner => {
  return async (graph: DecisionGraphType, fixtures: ContractFixture[]): Promise<ExampleRunReport> => {
    const report = await runDecisionTests({
      executor: async (fixture) => {
        const outcome = await simulateHandler(graph, fixture.input);
        const { simulation } = outcome;

        if (simulation.error) {
          return { error: simulation.error.message ?? simulation.error.title ?? 'simulation error' };
        }

        return {
          result: simulation.result?.result,
          traceHits: simulation.result ? Object.keys(simulation.result.trace ?? {}) : undefined,
        };
      },
      fixtures,
    });

    // 结构性兼容：zen-udf FixtureReport 与 kernel ExampleRunReport 同形
    //（CONTRACT §10 测试契约），此处赋值即编译期校验
    return report;
  };
};
