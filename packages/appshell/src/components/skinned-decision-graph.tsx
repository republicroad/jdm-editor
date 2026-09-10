import {
  DecisionGraph,
  type DecisionGraphProps,
  type DecisionGraphRef,
  type DecisionGraphType,
  GraphSimulator,
  type Simulation,
  type ToolbarItem,
} from '@republicroad/jdm-editor';
import { FlaskConicalIcon, PanelRightIcon } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '../context/theme.provider';
import type { SimulateHandler } from '../shell/types';
import { mapPanelSlotIds, mapToolbarSlots } from '../skin/layout';
import type { SkinSlotHostContext } from '../skin/types';
import { ShellHeader } from './shell-header';
import { ScrollArea } from './ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

type PanelItem = NonNullable<DecisionGraphProps['panels']>[number];

export type SkinnedDecisionGraphProps = DecisionGraphProps & {
  /**
   * 传入后自动注册左侧栏 simulator 面板（kernel GraphSimulator：输入 JSON →
   * Run → 画布命中高亮 + Output/Trace），onRun 经由此 handler 调执行引擎。
   * 不传则与直接渲染 `<DecisionGraph>` 行为完全一致。
   */
  simulateHandler?: SimulateHandler;
};

/**
 * 皮肤感知的 DecisionGraph（S005 P1）：读取 activeSkin.layout 把工具栏槽位
 * 映射为 kernel `toolbarItems`（追加在宿主自有项之后），其余 props 全透传。
 *
 * - 无皮肤 / 皮肤无 layout → 与直接渲染 `<DecisionGraph>` 行为完全一致
 * - ctx.graph 随受控 value 更新；graphRef 惰性挂载（挂载后首次重渲染时注入）
 */
export const SkinnedDecisionGraph = React.forwardRef<DecisionGraphRef, SkinnedDecisionGraphProps>((props, ref) => {
  const { activeSkin } = useTheme();
  const { simulateHandler, ...restProps } = props;
  const internalRef = useRef<DecisionGraphRef | null>(null);
  const [mounted, setMounted] = useState(false);
  const [simulation, setSimulation] = useState<Simulation | undefined>(undefined);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setRef = React.useCallback(
    (node: DecisionGraphRef | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  const toolbarItems = useMemo<ToolbarItem[] | undefined>(() => {
    const host: SkinSlotHostContext = {
      graph: (props.value ?? props.defaultValue) as DecisionGraphType | undefined,
      disabled: props.disabled,
      graphRef: mounted ? internalRef.current : null,
    };
    const mapped = mapToolbarSlots(activeSkin?.layout?.toolbar, host);
    if (!mapped) {
      return props.toolbarItems;
    }
    return [...(props.toolbarItems ?? []), ...mapped];
    // activeSkin 参与依赖：切肤即重映射
  }, [activeSkin, mounted, props.value, props.defaultValue, props.disabled, props.toolbarItems]);

  const panels = useMemo<DecisionGraphProps['panels']>(() => {
    if (!simulateHandler) {
      return props.panels;
    }
    const simulatorPanel: PanelItem = {
      id: 'simulator',
      title: 'Simulator',
      icon: <FlaskConicalIcon size={16} />,
      hideHeader: true,
      renderPanel: () => (
        <GraphSimulator
          defaultRequest={'{\n  \n}'}
          loading={running}
          onRun={({ graph, context }) => {
            setRunning(true);
            simulateHandler(graph as DecisionGraphType, context)
              .then((outcome) => setSimulation(outcome.simulation))
              .finally(() => setRunning(false));
          }}
          onClear={() => setSimulation(undefined)}
        />
      ),
    };
    return [...(props.panels ?? []), simulatorPanel];
  }, [props.panels, simulateHandler, running]);

  // S005 P2：右缘面板槽位（VersionHistoryPanel 同款 Sheet 容器）
  const rightSlots = useMemo(() => mapPanelSlotIds(activeSkin?.layout?.panels?.right), [activeSkin]);
  const rightSlotRenders = activeSkin?.layout?.panels?.right?.slots;
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  useEffect(() => {
    // 切肤/槽位变化后，打开态指向不存在的槽位时收起
    setOpenSlot((current) => (current && rightSlots?.includes(current) ? current : null));
  }, [rightSlots]);

  const slotContext: SkinSlotHostContext = {
    graph: (props.value ?? props.defaultValue) as DecisionGraphType | undefined,
    disabled: props.disabled,
    graphRef: mounted ? internalRef.current : null,
  };

  // S005 P3：皮肤头部槽位（ShellHeader，kernel 无 header）
  const headerSlots = activeSkin?.layout?.header?.slots;
  const hasHeader = !!(headerSlots?.left || headerSlots?.right);
  const headerNode = hasHeader ? (
    <ShellHeader graph={slotContext.graph} disabled={slotContext.disabled} graphRef={slotContext.graphRef} />
  ) : null;

  const hasRail = !!rightSlots?.length;
  const decisionGraph = (
    <DecisionGraph
      {...restProps}
      ref={setRef}
      toolbarItems={toolbarItems}
      panels={panels}
      simulate={props.simulate ?? simulation}
    />
  );

  const sheetNode = hasRail ? (
    <Sheet open={openSlot !== null} onOpenChange={(open) => !open && setOpenSlot(null)}>
      <SheetContent
        side='right'
        className='flex w-full flex-col gap-4 sm:max-w-md'
        aria-label={openSlot ? `Skin panel ${openSlot}` : undefined}
      >
        <SheetHeader>
          <SheetTitle>{openSlot}</SheetTitle>
        </SheetHeader>
        <ScrollArea className='-mx-2 min-h-0 flex-1 px-2'>
          {openSlot !== null &&
            rightSlotRenders?.[openSlot]?.({
              graph: slotContext.graph ?? { nodes: [], edges: [] },
              disabled: !!slotContext.disabled,
              graphRef: slotContext.graphRef,
            })}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  ) : null;

  const railNode = hasRail ? (
    <div
      aria-label='skin-panel-rail'
      className='flex w-12 shrink-0 flex-col items-center gap-2 border-l border-[var(--border)] bg-[var(--grl-color-bg-container)] py-2'
    >
      {rightSlots.map((slotId) => (
        <button
          key={slotId}
          type='button'
          title={`${openSlot === slotId ? 'Close' : 'Open'} ${slotId}`}
          aria-label={`${openSlot === slotId ? 'Close' : 'Open'} ${slotId}`}
          aria-expanded={openSlot === slotId}
          className='flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
          style={openSlot === slotId ? { background: 'rgba(0, 0, 0, 0.1)' } : undefined}
          onClick={() => setOpenSlot((current) => (current === slotId ? null : slotId))}
        >
          <PanelRightIcon className='h-4 w-4' />
        </button>
      ))}
    </div>
  ) : null;

  if (!hasHeader && !hasRail) {
    return <div className='contents'>{decisionGraph}</div>;
  }

  const body = hasRail ? (
    <div className='flex h-full min-h-0 w-full min-w-0 flex-1'>
      <div className='h-full min-w-0 flex-1'>{decisionGraph}</div>
      {railNode}
    </div>
  ) : (
    <div className='h-full min-w-0 flex-1'>{decisionGraph}</div>
  );

  return (
    <div className='flex h-full w-full min-h-0 flex-col'>
      {headerNode}
      {body}
      {sheetNode}
    </div>
  );
});
