import type { PipelineEdgeType, PipelineNodeType, TaskStatus } from '#components/blocks/flow-3/components/data';

/**
 * trace → flow-3 运行画布适配层：把 /v1/execute (trace:true) 的响应映射为
 * flow-3 的 nodes/edges（状态预计算，替代块内置 mock）。
 *
 * 状态映射：
 * - 节点在 trace 且无错            → succeeded（detail 标 UDF 耗时或序号）
 * - audit.observed 命中错误码       → failed（INVALID_PARAM / CIRCUIT_OPEN / REPLAY_JOURNAL_MISS…）
 * - 节点输出里任一 key 携带 error   → failed（UDF 结构化错误经 customNode 输出透出）
 * - inputNode                      → succeeded（入仓节点，trace 不含它）
 * - outputNode                     → succeeded 当 result 存在，否则 skipped
 * - 其余不在 trace 的节点           → skipped（switch 未走分支的下游）
 */

export type ExecuteTraceResponse = {
  result?: unknown;
  performance?: string;
  error?: string;
  trace?: Record<string, { id?: string; input?: unknown; output?: unknown; name?: string; order?: number }>;
  audit?: {
    decisionId?: string;
    observed?: Array<{
      key?: string;
      name?: string;
      semantics?: string;
      outcome?: unknown;
      micros?: number;
      code?: string | null;
      issues?: string[];
    }> | null;
  } | null;
};

type ModelNode = { id: string; type?: string; name?: string; position?: { x: number; y: number } };
type ModelEdge = { id: string; source: string; target: string };
type ModelGraph = { nodes: ModelNode[]; edges: ModelEdge[] };

const GLYPH_BY_NODE_TYPE: Record<string, string> = {
  inputNode: 'connection',
  outputNode: 'connection',
  customNode: 'custom',
  decisionTableNode: 'model',
  expressionNode: 'model',
  functionNode: 'model',
  switchNode: 'test',
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** 节点输出里任一 key 携带结构化 error → 该节点失败 */
const outputHasError = (output: unknown): boolean => {
  if (!isRecord(output)) return false;
  return Object.values(output).some((value) => isRecord(value) && isRecord(value.error));
};

/** failed 观察项 → 归属节点 id（按表达式 key 在 trace 输出里匹配） */
const failedNodeIds = (
  trace: NonNullable<ExecuteTraceResponse['trace']>,
  observed: NonNullable<NonNullable<ExecuteTraceResponse['audit']>['observed']>,
): Set<string> => {
  const failed = new Set<string>();
  for (const o of observed) {
    if (!o.code) continue;
    for (const [nodeId, entry] of Object.entries(trace)) {
      if (isRecord(entry?.output) && o.key !== undefined && o.key in entry.output) {
        failed.add(nodeId);
        break;
      }
    }
  }
  return failed;
};

export function toRunMonitorGraph(
  model: ModelGraph,
  response: ExecuteTraceResponse,
): { nodes: PipelineNodeType[]; edges: PipelineEdgeType[] } {
  const trace = response.trace ?? {};
  const observed = response.audit?.observed ?? [];
  const failed = failedNodeIds(trace, observed);
  const hasResult = response.result !== undefined && response.result !== null;

  const nodes: PipelineNodeType[] = model.nodes.map((node) => {
    const entry = trace[node.id];
    const nodeObserved = observed.filter(
      (o) =>
        isRecord(entry?.output) && o.key !== undefined && entry && isRecord(entry.output) && o.key! in entry.output,
    );
    const udfMicros = nodeObserved.reduce((sum, o) => sum + (o.micros ?? 0), 0);

    let status: TaskStatus = 'skipped';
    if (node.type === 'inputNode') status = 'succeeded';
    else if (entry) status = 'succeeded';
    else if (node.type === 'outputNode' && hasResult) status = 'succeeded';

    if (failed.has(node.id) || (entry && outputHasError(entry.output))) status = 'failed';

    const errorDetail = nodeObserved.find((o) => o.code)?.code;
    const detail =
      status === 'failed'
        ? String(errorDetail ?? 'error')
        : udfMicros > 0
          ? `${udfMicros.toFixed(1)}µs`
          : entry?.order !== undefined
            ? `#${entry.order}`
            : status === 'succeeded'
              ? (response.performance ?? 'ok')
              : '—';

    const params = nodeObserved.map((o) => ({
      key: `${o.name ?? 'udf'} · ${o.semantics ?? 'query'}`,
      value: `${JSON.stringify(o.outcome ?? null)}${o.micros ? ` · ${o.micros}µs` : ''}`,
      kind: 'text' as const,
    }));

    return {
      id: node.id,
      type: 'mark',
      position: node.position ?? { x: 0, y: 0 },
      deletable: false,
      data: {
        role: node.type === 'inputNode' ? 'trigger' : 'task',
        title: node.name ?? node.id,
        detail,
        status,
        glyph: (GLYPH_BY_NODE_TYPE[node.type ?? ''] ?? 'custom') as never,
        params,
      },
    } as PipelineNodeType;
  });

  const edges: PipelineEdgeType[] = model.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: 'out',
    targetHandle: 'in',
    type: 'flow',
  }));

  return { nodes, edges };
}
