import type { NodeSpecification } from '../nodes/specifications/specification-types';

/**
 * L6（ADR-008）面板搜索索引：规范字段（type/displayName/shortDescription/group）之外，
 * 纳入 spec.searchKeywords（schema 容器节点的内部工具名等）。
 * 返回值：null = 未命中或空 query；[] = 仅规范字段命中（无需高亮）；
 * 非空 = 经内部关键词命中，词条用于卡片高亮展示。
 *
 * 纯模块（不拉组件/WASM 依赖链），供 graph-components 与单测共用。
 */
export const matchComponent = (el: NodeSpecification, rawQuery: string): string[] | null => {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return null;
  }

  const ownHit = [el.type, el.displayName, el.shortDescription, el.group]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(query));
  if (ownHit) {
    return [];
  }

  const keywordHits = (el.searchKeywords ?? []).filter((keyword) => keyword.toLowerCase().includes(query));
  return keywordHits.length > 0 ? keywordHits : null;
};
