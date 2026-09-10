import type { DecisionGraphRef, DecisionGraphType } from '@republicroad/jdm-editor';
import type { ReactNode } from 'react';

import type { CustomNodeSpec } from '../lib/custom-node-registry';

// 内核 barrel 未导出 ThemeSeeds（声明在 theming/derive）——按公开 API 形状本地镜像
export type SkinSeeds = {
  primary?: string;
  success?: string;
  error?: string;
  warning?: string;
  info?: string;
  fieldInput?: string;
  fieldOutput?: string;
};

/** 节点 UI 槽位覆写：按 kind 劫持画布卡 / Tab 渲染，未指定的槽位回落原实现 */
export type NodeUiOverride = {
  renderTab?: CustomNodeSpec['renderTab'];
  renderNode?: CustomNodeSpec['renderNode'];
};

/** 槽位渲染上下文——与 CustomNodeSpec 渲染上下文对齐（S005 P1 最小集，宿主裁决见规格稿 §10-4） */
export type SkinSlotContext = {
  /** 当前图文档（受控值，随编辑实时更新） */
  graph: DecisionGraphType;
  /** kernel disabled 态（含画布 diff 对比模式等） */
  disabled: boolean;
  /** 图命令句柄；惰性挂载，早期可能为 null */
  graphRef?: DecisionGraphRef | null;
};

export type SkinSlotRender = (ctx: SkinSlotContext) => ReactNode;

/** P1 · 工具栏槽位（docs/design/skin-layout-slots.md §4） */
export type SkinToolbarLayout = {
  /** 槽位 id → 渲染函数；id 建议 host: 前缀（裸名 dev-warn + 自动补前缀） */
  slots?: Record<string, SkinSlotRender>;
  /** 槽位排列顺序（数组序即渲染序）；未列出的槽位排在列出的之后，按字典序 */
  order?: string[];
};

/** 布局槽位（P2 面板位置 / P3 头部后续追加，见规格稿 §5.2/§5.4） */
export type SkinLayout = {
  toolbar?: SkinToolbarLayout;
};

/** 皮肤 = 主题种子 + token 覆写 + 节点 UI 槽位覆写 + 布局槽位；一次切换即「一键换UI/换肤/换布局」 */
export type SkinDefinition = {
  id: string;
  label: string;
  seeds?: SkinSeeds;
  /** JdmConfigProvider theme.token 透传（优先级高于 seeds 派生） */
  tokens?: Record<string, string>;
  nodeOverrides?: Record<string, NodeUiOverride>;
  /** 布局槽位（S005）：缺省零渲染零开销，默认皮肤行为不变 */
  layout?: SkinLayout;
};

/** 槽位宿主上下文装载（SkinnedDecisionGraph 每次渲染时构造） */
export type SkinSlotHostContext = {
  graph?: DecisionGraphType;
  disabled?: boolean;
  graphRef?: DecisionGraphRef | null;
};
