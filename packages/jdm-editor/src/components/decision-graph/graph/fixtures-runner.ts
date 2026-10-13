import type { DecisionGraphType } from '../dg-types';

/**
 * ADR-013 批次三 / ADR-014：输入节点 Run all 的结构性类型。
 *
 * 形状与 zen-udf 0.13.0 的 DecisionFixture/FixtureReport 结构兼容——kernel
 * 零 zen-udf 依赖，宿主侧适配器（appshell）以 zen-udf runDecisionTests 产出
 * 报告后结构赋值注入。形状立法在 CONTRACT §10 测试契约，两处同步演进。
 */

export type ContractFixture = {
  name: string;
  input: unknown;
};

export type ExampleRunOutcome = 'passed' | 'assertion-failed' | 'execution-error';

export type ExampleRunResult = {
  name: string;
  passed: boolean;
  outcome: ExampleRunOutcome;
  actual?: unknown;
  error?: string;
  durationMs?: number;
  traceHits?: string[];
};

export type ExampleRunReport = {
  passed: number;
  failed: number;
  results: ExampleRunResult[];
};

/** 执行槽位：kernel 声明，宿主注入（appshell = simulateHandler 经 zen-udf runDecisionTests 适配） */
export type FixturesRunner = (graph: DecisionGraphType, fixtures: ContractFixture[]) => Promise<ExampleRunReport>;

export type ContractDriftEventKind = 'drift-detected' | 'drift-migrated' | 'drift-confirmed';

/** 漂移事件（数据装配归 kernel，appshell 只消费——薄层纪律）：输入节点契约漂移的设计期审计流 */
export type ContractDriftEvent = {
  /** ISO 时间戳 */
  at: string;
  nodeId: string;
  nodeName?: string;
  kind: ContractDriftEventKind;
  exampleNames: string[];
  counts?: {
    missing: number;
    extra: number;
    conflicts: number;
    /** ajv 约束违例数（懒加载，可能尚未就绪） */
    constraints: number;
  };
};
