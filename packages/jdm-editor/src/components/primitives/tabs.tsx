import * as React from 'react';
import { Tabs as UiTabs } from '@/components/ui/tabs';
import { TabsContent as UiTabsContent } from '@/components/ui/tabs';
import { TabsList as UiTabsList } from '@/components/ui/tabs';
import { TabsTrigger as UiTabsTrigger } from '@/components/ui/tabs';

import { cn } from '@/lib/utils';

/** @deprecated antd-migration compat alias — use {@link TabsItemType} instead. */
export interface AntdTabsItemType {
  key: string;
  label: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items?: AntdTabsItemType[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  type?: 'line' | 'card' | 'editable-card';
  size?: 'large' | 'middle' | 'small';
  className?: string;
  rootClassName?: string;
  style?: React.CSSProperties;
  tabBarExtraContent?: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  defaultActiveKey,
  onChange,
  size,
  className,
  rootClassName,
  style,
  tabBarExtraContent,
}) => {
  const list = items ?? [];
  const [uncontrolled, setUncontrolled] = React.useState<string>(
    defaultActiveKey ?? list[0]?.key ?? '',
  );
  const current = activeKey ?? uncontrolled;
  /*
   * Compact inline-tab rhythm (formerly .grl-inline-tabs in tailwind.css,
   * HK-02): expressed as utilities on the DOM we own instead of `!important`
   * overrides fighting injected styles. Transitional detection keeps the
   * three call sites unchanged; prefer passing explicit props going forward.
   */
  const compact = rootClassName?.includes('grl-inline-tabs') ?? false;

  const select = (key: string) => {
    if (activeKey === undefined) setUncontrolled(key);
    onChange?.(key);
  };

  return (
    <UiTabs value={current} onValueChange={select} style={style} className={cn(rootClassName, className)}>
      <div className="flex w-full items-center justify-between gap-2">
        <UiTabsList className={cn(size === 'small' && 'h-8', compact && 'm-0 p-0!')}>
          {list.map((item) => (
            <UiTabsTrigger
              key={item.key}
              value={item.key}
              disabled={item.disabled}
              className={cn(compact && 'px-3.5 text-[13px]')}
            >
              {item.label}
            </UiTabsTrigger>
          ))}
        </UiTabsList>
        {tabBarExtraContent}
      </div>
      {list.map((item) => (
        <UiTabsContent
          key={item.key}
          value={item.key}
          // antd semantics: items without children carry no panel content.
          // Keep the node mounted (Radix/tests may query it) but hide it so
          // shadcn's `flex gap-2` root injects no phantom gap below a
          // standalone bar.
          className={cn(item.children === undefined && 'hidden!')}
        >
          {item.children}
        </UiTabsContent>
      ))}
    </UiTabs>
  );
};

/** Neutral name (antd-migration compat surface). */
export type TabsItemType = AntdTabsItemType;
