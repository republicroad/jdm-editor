# S005 · 皮肤布局槽位规格稿 v1（SkinDefinition.layout）

- 状态: spec-ready（待宿主确认 4 项后进入实现，见 §9）
- 目标库: `@republicroad/jdm-editor`（锚点）+ `@republicroad/jdm-appshell`（模式与映射）
- 提出方: editor 会话（第五十七批），规格化: kernel 会话（2026-09-10）
- 需求来源: libsuggest S005（宿主 ocean + 默认双皮肤实践中的布局能力缺口）
- 关联: `docs/libsuggest/S005-skin-layout-slots.md`（原始需求稿，本文为其规格化落地）

## 1. 目标与非目标

**目标**：宿主换肤时，除节点外观（现有 `nodeOverrides`）外，还能决定"编辑器界面
怎么摆"——向工具栏、画布边缘面板、头部注入自有 UI（如"模拟运行/发布"按钮、版本
历史面板、环境徽标），且注入点随皮肤切换生效/消失。

**非目标**：

- 自由拖拽布局、槽位运行时重排（P3+ 再议）
- kernel 感知皮肤——kernel 只提供中性锚点，`SkinDefinition` 与映射层全部在 appshell
- 替换/移除 kernel 原生工具栏项（只做"追加注入"，原生项不可卸除；如需隐藏走现有
  `hideLeftToolbar` 等开关）

## 2. 现状盘点（锚点缺口，2026-09-10 实测）

| 注入面 | kernel 现状 | 缺口 |
| --- | --- | --- |
| 面板 | 已有中性注入点：`PanelType = { id, icon, title, renderPanel?, hideHeader?, onClick? }`（`dg-store.context.tsx:26`），经 `DecisionGraphProps.panels` 注入左侧栏 | 缺**位置维度**（现全部单侧挂载；需求为 left/right/bottom） |
| 工具栏 | `graph-side-toolbar.tsx` 全硬编码（上传/下载/搜索/模拟），无注入 API | 需新增 `toolbarItems` 锚点（**P1，宿主价值最高**） |
| 头部 | kernel 无 header 概念 | P3：appshell 壳层组件解决，不动 kernel（见 §5.4） |

appshell 现状：`SkinDefinition`（`src/skin/types.ts`）= `id/label` + `seeds`（色板
种子）+ `tokens`（token 透传）+ `nodeOverrides`（节点 UI 劫持），粒度到节点为止。

## 3. 架构：双层设计

```
SkinDefinition.layout（appshell，皮肤语义）
        │  SkinnedDecisionGraph（映射层，appshell）
        ▼
中性锚点 props（kernel，皮肤无感知）
  toolbarItems? / panels(position?) / …
        │
        ▼
DecisionGraph 渲染（锚点埋点 + ErrorBoundary 隔离）
```

裁决理由：kernel 保持皮肤无感知（不 import `SkinDefinition`），锚点 API 是通用的
"宿主注入点"，未来无皮肤的宿主也能直接用；皮肤语义（槽位命名、order、`host:` 前
缀校验）集中在 appshell 映射层——与 `nodeOverrides` 经 `useCustomNodes` 劫持的同
构模式一致，心智不新增。

## 4. 模式定义（appshell 侧，追加进 `src/skin/types.ts`）

```ts
import type { DecisionGraphRef, DecisionGraphType } from '@republicroad/jdm-editor';

/** 槽位渲染上下文——与 CustomNodeSpec 渲染上下文对齐 */
export type SkinSlotContext = {
  /** 当前图文档（受控值，随编辑实时更新） */
  graph: DecisionGraphType;
  /** kernel disabled 态（含画布 diff 对比模式等） */
  disabled: boolean;
  /** 图命令句柄（模拟运行、视口控制等）；惰性挂载，早期为 undefined */
  graphRef?: DecisionGraphRef;
};

export type SkinSlotRender = (ctx: SkinSlotContext) => ReactNode;

export type SkinLayout = {
  /** P1：工具栏槽位 */
  toolbar?: {
    /** 槽位 id → 渲染函数；id 建议带 host: 前缀（§6 命名空间） */
    slots?: Record<string, SkinSlotRender>;
    /** 槽位排列顺序（数组序即渲染序）；未列出的槽位排在列出的之后，按字典序 */
    order?: string[];
  };
  /** P2：画布边缘面板槽位（依赖 kernel PanelType.position，§5.2） */
  panels?: Partial<Record<'left' | 'right' | 'bottom', { slots?: Record<string, SkinSlotRender> }>>;
  /** P3：头部锚点（appshell 壳层实现，§5.4） */
  header?: { slots?: Partial<Record<'left' | 'right', SkinSlotRender>> };
};

export type SkinDefinition = {
  // …现有 id/label/seeds/tokens/nodeOverrides 不变…
  layout?: SkinLayout;
};
```

映射层新增公开组件 `SkinnedDecisionGraph`（appshell）：内部 `useTheme()` 取
`activeSkin`，将 `layout.toolbar.slots + order` 映射为 kernel `toolbarItems`，将
`layout.panels` 映射为带位置的 `panels`，透传其余 props。宿主从直接渲染
`<DecisionGraph>` 换为 `<SkinnedDecisionGraph>` 即接入；无皮肤时行为与直渲染
`DecisionGraph` 完全一致。

## 5. kernel 锚点 API（中性，分阶段交付）

### 5.1 P1 · 工具栏：`toolbarItems`

```ts
/** DecisionGraphProps 追加 */
toolbarItems?: ToolbarItem[];

export type ToolbarItem = {
  /** 全局唯一；宿主注入建议 host: 前缀（kernel 不强制，appshell 映射层校验提示） */
  id: string;
  /** 语义分组；组变化处渲染分隔线。保留组名：'export' | 'simulate'；缺省 = 独立组 */
  group?: string;
  /** 组内排序 hint，缺省 0；同 hint 按数组序稳定排序 */
  order?: number;
  /** 惰性渲染：kernel 传 disabled 态；皮肤槽位的富上下文由 appshell 映射层闭包注入 */
  render: (ctx: { disabled: boolean }) => ReactNode;
};
```

渲染语义（埋点在 `graph-side-toolbar` 既有分组之后）：

1. 原生项先行（现状不变），注入项追加在后；
2. 注入项排序：`group` 聚类 → 组间按首次出现序 → 组内按 `order` 后数组序；
3. 相邻不同组之间渲染竖分隔线（复用现有 divider 样式）；
4. 每个 item 独立 `ErrorBoundary`（§7）。

### 5.2 P2 · 面板位置：`PanelType.position`

```ts
export type PanelType = {
  // …现有字段不变…
  /** 面板停靠位置；缺省 'left' 完全向后兼容 */
  position?: 'left' | 'right' | 'bottom';
};
```

- `left`：走现役左侧栏（零改动）
- `right`：右侧栏镜像实现（图标轨 + Sheet 从右滑出，复用 VersionHistoryPanel 同款
  Sheet 容器样式）
- `bottom`：基于 `react-resizable-panels`（tab-json-schema 已引入）加水平
  PanelGroup；实现量最大，**是否交付取决于宿主确认（§9-2）**

`activePanel` 全局唯一性维持现状（同刻至多一个激活面板，跨位置也不叠加）。

### 5.3 面板槽位映射

`layout.panels[place].slots` → appshell 为每个槽位生成 `PanelType`
（`id: host:<name>`、icon 缺省 Plug 图标、`title: <name>`、`renderPanel` 闭包
`SkinSlotContext`），合并进 `panels` 数组。槽位面板与宿主自摆面板共存（宿主仍可
直接传 `panels`）。

### 5.4 P3 · 头部：appshell 壳层，不动 kernel

kernel 无 header 且不应有（页面骨架属宿主）。规格：appshell 新增
`ShellHeader` 组合组件——渲染标题区（左：标题槽，右：`header.slots.left/right`
注入点 + 主题切换），`SkinnedDecisionGraph` 可选包裹。宿主页面层自摆的现状可迁
入，ocean/默认双皮肤各自决定左右内容。

## 6. 约束（硬性）

1. **缺省零开销**：`layout` 缺省 → kernel 锚点 props 为 undefined → 埋点零渲染、
   零快照差异（以默认皮肤快照测试防回归）
2. **命名空间**：皮肤槽位 id 必须 `host:` 前缀（如 `host:toolbar.publish`）；映射
   层对裸名 `console.warn`（dev only）并自动补前缀；kernel 保留裸名命名空间
3. **只做锚点 + 注入**：不提供槽位移除/替换原生项能力，不做运行时布局拖拽
4. **故障隔离**：kernel 对每个注入项包 `ErrorBoundary`，槽位渲染抛错 → 该槽位
   降级为不渲染 + `console.error`，不弹 toast、不拖垮编辑器
5. **主题一致性**：槽位渲染在 `JdmConfigProvider` 作用域内（`SkinnedDecisionGraph`
   位于 `ThemeContextProvider` 树内），深浅色与 token 自动继承，锚点不做额外处理
6. **i18n**：槽位内容属宿主，kernel/appshell 不提供槽位文案目录

## 7. 测试策略

- **kernel**（vitest + RTL）：`toolbarItems` 渲染/分组分隔线/order 稳定排序/
  未注入零渲染快照/ErrorBoundary 降级；P2 增 `position` 三态挂载与 `activePanel`
  唯一性
- **appshell**：`SkinDefinition.layout → toolbarItems/panels` 映射纯函数测试
  （order 语义、裸名 warn+补前缀、缺省透传）；`SkinnedDecisionGraph` 集成
  （有无皮肤两态）；槽位抛错不冒泡
- **playground**（E2E 目检）：新增第二套演示皮肤（ocean），注入
  `host:toolbar.hello` 按钮 + 一条右侧槽位面板，双肤切换 + 深浅色全组合目检
- **CI**：复用 `pnpm verify`，无新增流水线

## 8. 分期与发版

| 期 | 内容 | 发版口径 |
| --- | --- | --- |
| P1 | kernel `toolbarItems` + appshell `SkinLayout.toolbar` 映射 + `SkinnedDecisionGraph` + playground 演示 | kernel/appshell 0.6.0（新 props，均为可选追加，非破坏） |
| P2 | kernel `PanelType.position`（right/bottom）+ appshell `layout.panels` | kernel/appshell 0.7.0（bottom 视 §9-2 确认结果可裁剪） |
| P3 | appshell `ShellHeader` + `layout.header` | appshell 0.8.0（kernel 不动） |

每期独立可发版、可回滚；P1 落地即满足宿主"发布/模拟按钮入栏"的最高优先诉求。

## 9. 待宿主确认项（阻塞实现，不阻塞规格）

1. **工具栏分组命名**：保留组 `'export' | 'simulate'` 是否够用？宿主"发布"按钮
   期望进既有组还是独立 `host` 组（独立组 = 最右分隔线后）？
2. **bottom 面板真伪需求**：宿主是否确有底部停靠场景（请求面板类）？若无，P2 只
   交付 `right`，裁掉 PanelGroup 重排工作量
3. **header 锚点归属**：接受"appshell 壳层 `ShellHeader`"方案，还是期望挂在
   kernel 图头（tab 条上方）？前者不动 kernel、后者与画布视觉更连贯
4. **SkinSlotContext 富度**：是否需要 `simulate` 结果、当前激活 Tab 等运行时
   上下文？P1 先交付最小集 `{ graph, disabled, graphRef }`，富上下文按需追加
   （向后兼容）
