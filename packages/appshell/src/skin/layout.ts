import type { ToolbarItem } from '@republicroad/jdm-editor';

import type { SkinSlotHostContext, SkinToolbarLayout } from './types';

/**
 * skin.toolbar 槽位 → kernel ToolbarItem[]（S005 P1 映射纯函数）。
 *
 * - 无槽位返回 undefined（零注入透传，SkinnedDecisionGraph 不改写宿主 props）
 * - 裸名 id dev-warn 并自动补 `host:` 前缀（规格稿 §6-2 命名空间）
 * - order 数组序优先，未列出者按字典序排在之后（规格稿 §4）
 * - 注入项全部落在缺省独立组：聚在最右分隔线后（规格稿 §10-1 宿主裁决）
 */
export function mapToolbarSlots(
  layout: SkinToolbarLayout | undefined,
  host: SkinSlotHostContext,
): ToolbarItem[] | undefined {
  const entries = Object.entries(layout?.slots ?? {});
  if (entries.length === 0) {
    return undefined;
  }

  if (import.meta.env?.DEV) {
    for (const [id] of entries) {
      if (!id.startsWith('host:')) {
        console.warn(`[jdm-appshell] skin toolbar slot "${id}" lacks host: prefix — auto-prefixed`);
      }
    }
  }

  const order = layout?.order ?? [];
  const rank = (id: string): number => {
    const at = order.indexOf(id);
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
  const sorted = [...entries].sort(([a], [b]) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));

  return sorted.map(([id, render]) => {
    const slotId = id.startsWith('host:') ? id : `host:${id}`;
    return {
      id: slotId,
      render: (kernelCtx: { disabled: boolean }) =>
        render({
          graph: host.graph ?? { nodes: [], edges: [] },
          disabled: kernelCtx.disabled,
          graphRef: host.graphRef,
        }),
    };
  });
}
