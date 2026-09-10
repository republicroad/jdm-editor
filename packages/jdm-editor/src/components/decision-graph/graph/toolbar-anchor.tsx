import React from 'react';

import { SafeBoundary } from '../../safe-boundary';
import { useDecisionGraphState } from '../context/dg-store.context';

/**
 * 工具栏注入项（S005 P1 中性锚点，皮肤无感知）：
 * 渲染在页签条右端（原生操作之后），group 变化处出现分隔线。
 * 宿主/皮肤注入建议 host: 前缀 id（kernel 不强制，appshell 映射层校验）。
 */
export type ToolbarItem = {
  /** 全局唯一 */
  id: string;
  /**
   * 语义分组；组变化处渲染分隔线。保留组名：'export' | 'simulate'；
   * 缺省 = 独立组（最右分隔线后）。
   */
  group?: string;
  /** 组内排序 hint，缺省 0；同 hint 按数组序稳定排序 */
  order?: number;
  /** 惰性渲染；disabled 随画布态传入 */
  render: (ctx: { disabled: boolean }) => React.ReactNode;
};

/** 组间按首次出现序，组内按 order 后数组序（稳定排序） */
export const clusterToolbarItems = (items: ToolbarItem[]): ToolbarItem[] => {
  const buckets: { group: string; items: ToolbarItem[] }[] = [];
  for (const item of items) {
    const group = item.group ?? '';
    let bucket = buckets.find((b) => b.group === group);
    if (!bucket) {
      bucket = { group, items: [] };
      buckets.push(bucket);
    }
    bucket.items.push(item);
  }
  return buckets.flatMap((bucket) =>
    bucket.items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (a.item.order ?? 0) - (b.item.order ?? 0) || a.index - b.index)
      .map(({ item }) => item),
  );
};

/** render 调用必须发生在边界内部子组件——ErrorBoundary 捕获不到自身 render 期的抛错 */
const SlotRenderer: React.FC<{ item: ToolbarItem; disabled: boolean }> = ({ item, disabled }) => {
  return <>{item.render({ disabled })}</>;
};

/**
 * 工具栏锚点：无注入项时渲染 null（零开销，见 docs/design/skin-layout-slots.md §6-1）；
 * 每个注入项独立 SafeBoundary——槽位抛错降级为该槽位不渲染，不拖垮编辑器。
 */
export const ToolbarAnchor: React.FC<{ items?: ToolbarItem[] }> = ({ items }) => {
  const { disabled = false } = useDecisionGraphState(({ disabled }) => ({ disabled }));

  if (!items || items.length === 0) {
    return null;
  }

  const clustered = clusterToolbarItems(items);
  const groups: string[] = [];
  for (const item of clustered) {
    if (!groups.includes(item.group ?? '')) groups.push(item.group ?? '');
  }

  return (
    <div aria-label='toolbar-items' className='ml-1 flex items-center gap-1 border-l border-[var(--border)] pl-2'>
      {groups.map((group, gi) => (
        <React.Fragment key={group || `__anonymous_${gi}`}>
          {gi > 0 && <span aria-hidden className='mx-1 h-4 w-px bg-[var(--border)]' />}
          {clustered
            .filter((item) => (item.group ?? '') === group)
            .map((item) => (
              <SafeBoundary
                key={item.id}
                fallback={null}
                onError={(error) => console.error(`[jdm-editor] toolbar item "${item.id}" crashed:`, error)}
              >
                <SlotRenderer item={item} disabled={disabled} />
              </SafeBoundary>
            ))}
        </React.Fragment>
      ))}
    </div>
  );
};
