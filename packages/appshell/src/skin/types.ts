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

/** 皮肤 = 主题种子 + token 覆写 + 节点 UI 槽位覆写；一次切换即「一键换UI/换肤」 */
export type SkinDefinition = {
  id: string;
  label: string;
  seeds?: SkinSeeds;
  /** JdmConfigProvider theme.token 透传（优先级高于 seeds 派生） */
  tokens?: Record<string, string>;
  nodeOverrides?: Record<string, NodeUiOverride>;
};
