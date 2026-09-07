import type { DecisionGraphType } from '../dg-types';

/** 单个节点/边的变更描述（name/kind 便于面板按类型展示） */
export type GraphNodeChange = {
  id: string;
  /** 变更后名称（removed 条目为变更前名称） */
  name?: string;
  /** 节点 type / 边 type（customNode kind 等） */
  kind?: string;
  /** 内容发生变化的顶层字段名列表（可选增强） */
  fields?: string[];
};

export type GraphDiff = {
  addedNodes: GraphNodeChange[];
  removedNodes: GraphNodeChange[];
  modifiedNodes: GraphNodeChange[];
  addedEdges: GraphNodeChange[];
  removedEdges: GraphNodeChange[];
  modifiedEdges: GraphNodeChange[];
  /** 全部为空 = true（内容相同；仅位置变化也算无变化） */
  unchanged: boolean;
};

/** 运行时元数据不参与内容比较：position 属于布局（spec 验收 #2），_diff 是图内 diff 染色残留 */
const IGNORED_NODE_KEYS = new Set(['position', '_diff']);
const IGNORED_EDGE_KEYS = new Set(['_diff']);

/** 递归排序对象键后再序列化——语义相等即字符串相等，不受键插入顺序影响 */
const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
};

type Item = { id: string; name?: string; type?: string; [key: string]: unknown };

const strip = (item: Item, ignored: Set<string>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(item).filter(([k]) => !ignored.has(k)));

const changedFields = (a: Item, b: Item, ignored: Set<string>): string[] => {
  const keys = new Set([...Object.keys(strip(a, ignored)), ...Object.keys(strip(b, ignored))]);
  return [...keys].filter(
    (k) => canonicalize((a as Record<string, unknown>)[k]) !== canonicalize((b as Record<string, unknown>)[k]),
  );
};

const diffById = (aItems: Item[], bItems: Item[], ignored: Set<string>) => {
  const aMap = new Map(aItems.map((item) => [item.id, item]));
  const bMap = new Map(bItems.map((item) => [item.id, item]));

  const added: GraphNodeChange[] = [];
  const removed: GraphNodeChange[] = [];
  const modified: GraphNodeChange[] = [];

  for (const [id, item] of bMap) {
    if (!aMap.has(id)) {
      added.push({ id, name: item.name, kind: item.type });
    }
  }
  for (const [id, item] of aMap) {
    const incoming = bMap.get(id);
    if (!incoming) {
      removed.push({ id, name: item.name, kind: item.type });
      continue;
    }
    const fields = changedFields(item, incoming, ignored);
    if (fields.length > 0) {
      modified.push({ id, name: incoming.name ?? item.name, kind: incoming.type ?? item.type, fields });
    }
  }

  return { added, removed, modified };
};

/**
 * 版本对比纯函数引擎（P1 面板变更清单）：按 id 结构化 diff 两版图 JSON。
 *
 * - 节点/边分别以 id 为身份：added = b 有 a 无；removed = a 有 b 无；
 *   modified = 双方都有且规范化内容不等（键序无关、忽略 position/_diff）
 * - modified 条目携带字段级 `fields` 明细
 * - 无副作用、无 React 依赖；`unchanged` 供面板显示「无变化」
 */
export const computeGraphDiff = (a: DecisionGraphType, b: DecisionGraphType): GraphDiff => {
  const nodes = diffById((a.nodes ?? []) as unknown as Item[], (b.nodes ?? []) as unknown as Item[], IGNORED_NODE_KEYS);
  const edges = diffById((a.edges ?? []) as unknown as Item[], (b.edges ?? []) as unknown as Item[], IGNORED_EDGE_KEYS);

  return {
    addedNodes: nodes.added,
    removedNodes: nodes.removed,
    modifiedNodes: nodes.modified,
    addedEdges: edges.added,
    removedEdges: edges.removed,
    modifiedEdges: edges.modified,
    unchanged:
      nodes.added.length +
        nodes.removed.length +
        nodes.modified.length +
        edges.added.length +
        edges.removed.length +
        edges.modified.length ===
      0,
  };
};
