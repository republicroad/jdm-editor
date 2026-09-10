import {
  DecisionGraph,
  type DecisionGraphProps,
  type DecisionGraphRef,
  type DecisionGraphType,
  GraphSimulator,
  type Simulation,
  type ToolbarItem,
} from '@republicroad/jdm-editor';
import { FlaskConicalIcon } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '../context/theme.provider';
import type { SimulateHandler } from '../shell/types';
import { mapToolbarSlots } from '../skin/layout';
import type { SkinSlotHostContext } from '../skin/types';

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

  return (
    <DecisionGraph
      {...restProps}
      ref={setRef}
      toolbarItems={toolbarItems}
      panels={panels}
      simulate={props.simulate ?? simulation}
    />
  );
});
