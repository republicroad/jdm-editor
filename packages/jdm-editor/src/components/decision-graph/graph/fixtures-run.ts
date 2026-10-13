import {
  getRequestDefinitions,
  isRecord,
  mergeRequestExampleDefaultsByDefinitions,
  normalizeRequestExampleDataByDefinitions,
  readRequestInputContract,
} from '../../../helpers/request-schema';
import type { DecisionGraphType } from '../dg-types';
import type { ContractFixture, FixturesRunner } from './fixtures-runner';

/**
 * ADR-013 批次三 / UI-A（分屏范式 §1.2）：图级 Fixtures 面板的纯函数基座。
 * 从图中定位输入节点 → 契约示例集 → ContractFixture[]（默认值合并 + datetime
 * 归一——与单例仿真的 getPreparedExampleData 同款预处理）。
 */

export const findInputNode = (graph: DecisionGraphType, nodeId: string) =>
  (graph.nodes ?? []).find((node) => node.id === nodeId && node.type === 'inputNode');

export const listInputNodes = (graph: DecisionGraphType) =>
  (graph.nodes ?? []).filter((node) => node.type === 'inputNode');

export const buildContractFixtures = (graph: DecisionGraphType, nodeId: string): ContractFixture[] | null => {
  const node = findInputNode(graph, nodeId);

  if (!node || !isRecord(node.content)) {
    return null;
  }

  const { contract } = readRequestInputContract(node.content);

  if (contract.examples.length === 0) {
    return null;
  }

  const definitions = getRequestDefinitions(node.content);

  return contract.examples.map((example, index) => {
    const input = normalizeRequestExampleDataByDefinitions(
      mergeRequestExampleDefaultsByDefinitions(example.data, definitions),
      definitions,
    );

    return {
      name: example.name.trim() || `#${index + 1}`,
      input,
    };
  });
};

/** 面板/节点按钮共用的运行入口；无示例集返回 null（不产生空跑） */
export const runFixturesForNode = async (
  graph: DecisionGraphType,
  nodeId: string,
  runner: FixturesRunner,
): Promise<ExampleRunReportOrNull> => {
  const fixtures = buildContractFixtures(graph, nodeId);

  if (!fixtures) {
    return null;
  }

  return runner(graph, fixtures);
};

type ExampleRunReportOrNull = Awaited<ReturnType<FixturesRunner>> | null;
