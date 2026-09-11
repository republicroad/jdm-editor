import type { DecisionGraphRef, DecisionGraphType } from '@republicroad/jdm-editor';
import React from 'react';

import { useTheme } from '../context/theme.provider';
import type { SkinSlotContext } from '../skin/types';

export type ShellHeaderProps = {
  /** 注入槽位的图文档（SkinnedDecisionGraph 自动传入；独立使用时由宿主提供） */
  graph?: DecisionGraphType;
  disabled?: boolean;
  /**
   * 决策图引用：ref 对象（`useRef` 产物，内部自动解包为当前句柄）或句柄本身；
   * null = 尚未挂载。
   */
  graphRef?: DecisionGraphRef | React.RefObject<DecisionGraphRef | null> | null;
  className?: string;
};

type GraphRefInput = NonNullable<ShellHeaderProps['graphRef']>;

const isRefObject = (value: GraphRefInput): value is React.RefObject<DecisionGraphRef | null> => 'current' in value;

const resolveGraphRef = (value: ShellHeaderProps['graphRef']): DecisionGraphRef | null => {
  if (value == null) return null;
  return isRefObject(value) ? value.current : value;
};

/**
 * 皮肤头部（S005 P3）：渲染 activeSkin.layout.header 的 left/right 槽位——
 * 左侧标题/环境标识、右侧状态徽标/操作，均注入 SkinSlotContext。
 * kernel 保持无 header（页面骨架属宿主，规格稿 §10-3 宿主裁决）；
 * 无槽位时返回 null，宿主页面层头部不受影响。
 */
export const ShellHeader: React.FC<ShellHeaderProps> = ({ graph, disabled, graphRef, className }) => {
  const { activeSkin } = useTheme();
  const slots = activeSkin?.layout?.header?.slots;

  if (!slots?.left && !slots?.right) {
    return null;
  }

  const handle = resolveGraphRef(graphRef);
  const ctx: SkinSlotContext = {
    graph: graph ?? { nodes: [], edges: [] },
    disabled: !!disabled,
    graphRef: handle,
  };

  return (
    <header
      className={
        className ??
        'flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--grl-color-bg-container)] px-4'
      }
    >
      <div className='flex min-w-0 items-center gap-3'>{slots.left?.(ctx)}</div>
      <div className='flex shrink-0 items-center gap-3'>{slots.right?.(ctx)}</div>
    </header>
  );
};
