import type { ToolbarItem } from '@republicroad/jdm-editor';

import type { SkinSlotHostContext, SkinToolbarLayout } from './types';

/** 槽位排序：order 数组序优先，未列出者按字典序排后（toolbar/panels 共用语义） */
export const orderSlotEntries = <T>(entries: [string, T][], order: string[] | undefined): [string, T][] => {
  const rank = order ?? [];
  return [...entries].sort(([a], [b]) => {
    const ia = rank.indexOf(a);
    const ib = rank.indexOf(b);
    const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
    const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
    return ra - rb || (a < b ? -1 : a > b ? 1 : 0);
  });
};

/** 裸名槽位 id dev-warn 并补 host: 前缀（规格稿 §6-2 命名空间） */
export const ensureHostPrefix = (id: string): string => {
  if (import.meta.env?.DEV && !id.startsWith('host:')) {
    console.warn(`[jdm-appshell] skin slot "${id}" lacks host: prefix — auto-prefixed`);
  }
  return id.startsWith('host:') ? id : `host:${id}`;
};

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

  const sorted = orderSlotEntries(entries, layout?.order);

  return sorted.map(([id, render]) => {
    const slotId = ensureHostPrefix(id);
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

/** 右缘面板槽位的有序 id 列表（无槽位返回 undefined；裸名同样 dev-warn 补前缀） */
export function mapPanelSlotIds(layout: SkinToolbarLayout | undefined): string[] | undefined {
  const entries = Object.entries(layout?.slots ?? {});
  if (entries.length === 0) {
    return undefined;
  }
  if (import.meta.env?.DEV) {
    for (const [id] of entries) {
      if (!id.startsWith('host:')) {
        console.warn(`[jdm-appshell] skin panel slot "${id}" lacks host: prefix — auto-prefixed`);
      }
    }
  }
  return orderSlotEntries(entries, layout?.order).map(([id]) => ensureHostPrefix(id));
}
