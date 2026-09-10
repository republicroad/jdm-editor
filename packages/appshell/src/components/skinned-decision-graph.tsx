import {
  DecisionGraph,
  type DecisionGraphProps,
  type DecisionGraphRef,
  type DecisionGraphType,
  type ToolbarItem,
} from '@republicroad/jdm-editor';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '../context/theme.provider';
import { mapToolbarSlots } from '../skin/layout';
import type { SkinSlotHostContext } from '../skin/types';

export type SkinnedDecisionGraphProps = DecisionGraphProps;

/**
 * 皮肤感知的 DecisionGraph（S005 P1）：读取 activeSkin.layout 把工具栏槽位
 * 映射为 kernel `toolbarItems`（追加在宿主自有项之后），其余 props 全透传。
 *
 * - 无皮肤 / 皮肤无 layout → 与直接渲染 `<DecisionGraph>` 行为完全一致
 * - ctx.graph 随受控 value 更新；graphRef 惰性挂载（挂载后首次重渲染时注入）
 */
export const SkinnedDecisionGraph = React.forwardRef<DecisionGraphRef, SkinnedDecisionGraphProps>((props, ref) => {
  const { activeSkin } = useTheme();
  const internalRef = useRef<DecisionGraphRef | null>(null);
  const [mounted, setMounted] = useState(false);

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

  return <DecisionGraph {...props} ref={setRef} toolbarItems={toolbarItems} />;
});
