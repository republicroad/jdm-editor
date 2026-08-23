# 迁移 03 — 迁移后回归修复

> 状态:**已完成**。antd → shadcn/ui 迁移(`02-ui-stack-shadcn-reui.zh-CN.md`)宣告完成后,
> 在 Storybook 人工验收中发现的后续修复。
> 英文版为准:[`03-post-migration-fixes.md`](./03-post-migration-fixes.md)。
> 注意:`docs/` 目录不入库(gitignored);下列代码改动均已提交至 `reui` 分支。

## 修复一览

| # | 现象 | 根因 | 修复 | 提交 |
|---|---|---|---|---|
| 1 | 画布节点图标、组件面板图标不可见 | 主题重写丢失 `--node-color-*` CSS 变量;图标是彩色圆角底上的白色字形,底色失效变透明 | 在 `theme.tsx` 的 `exposedTokens` 中补回四个变量 | `7dc1add` |
| 2 | 矮视口下决策图看似空白 | 未开 `fitView`,节点按绝对坐标排在矮画布可视区之外 | `<ReactFlow fitView={!initialViewport.current} fitViewOptions={{ padding: 0.15 }}>`;已持久化视口的图行为不变 | `6a9c4f0` |
| 3 | 节点 ⋮ 菜单点变成横排 | antd `MoreOutlined` 为竖排;lucide `Ellipsis` 为横排 | `icons.tsx`:`EllipsisVertical as MoreOutlined` | `f7d1ecd` |
| 4 | 左键点节点菜单无反应(菜单实际挂在视口外 `(0,-148)`);两条顽固 ref 告警 | `ui/button.tsx` 是普通函数组件、从 props 解构 `ref`——**React 18 会剥离函数组件 props 中的 ref**,Radix `asChild` 触发器拿不到 DOM 锚点,所有弹出层退化为原点定位 | `ui/button.tsx` 改为标准 `React.forwardRef`(配合 compat 层 forwardRef,`c12408a`) | `c12408a`、`0c81356` |

## 详情

### 1. 主题重写丢失节点色变量(`7dc1add`)

`.grl-dn__header__icon` 是"白字形 + `background: var(--node-color)` 彩色底"。规格层
(`nodes/specifications/colors.ts`)把节点类型映射到
`var(--node-color-blue|purple|orange|green)`。旧主题提供器负责注入这些变量,静态色板重写时被
遗漏 → 底色透明 → 白底白字隐形。恢复值:

```ts
'--node-color-blue': 'var(--grl-color-primary)',
'--node-color-purple': '#7c4dff',
'--node-color-orange': '#f76d40',
'--node-color-green': '#10ac84',
```

教训:重写主题提供器前,先盘点 SCSS 消费的**全部 CSS 自定义属性**
(`rg '\-\-[a-z-]+' src/**/*.scss`)与新旧提供器的输出差集,再删除旧实现。

### 2. 图视口自动适配(`6a9c4f0`)

节点按绝对坐标渲染。宿主容器过矮时(如 DevTools 停靠后窗口仅约 340px 高),多数节点落在
可视画布之外——与"什么都没渲染"无法区分。现在只要 JDM 文档未携带持久化视口,初始化即
`fitView` 缩放全图入画;带持久化视口(`defaultViewport`)的路径保持原行为。

### 3. 竖向三点图标(`f7d1ecd`)

纯图标语义漂移修正(`icons.tsx`):antd `MoreOutlined`(⋮)曾映射到 lucide `Ellipsis`(⋯),
现改为 `EllipsisVertical`。这正是迁移 02 风险清单中"图标语义漂移"一项——由人工视觉审查发现。

### 4. 非 forwardRef Button 导致 Radix 弹层锚点失效(`c12408a`、`0c81356`)

引用链:`DropdownMenuTrigger asChild` → Slot 携带 `ref` 克隆子元素 → 子组件必须是
`forwardRef` 组件。本次叠加了两处缺陷:

1. compat 层 `Button`(`primitives.tsx`)未转发 ref(`c12408a`);
2. 底层 shadcn `ui/button.tsx` 通过解构 props 接收 `ref` —— React 19 语义,在 React 18 下静默
   失效(ref 被剥离并产生告警)。后果:锚点缺失 → floating-ui 以虚拟原点定位 → 菜单/气泡/
   Tooltip 实际挂在 `(0,-148)` 等视口外坐标,开关逻辑正常但永远看不见。

修复将 `ui/button.tsx` 改为标准 `React.forwardRef<HTMLButtonElement, Props>` 并设置
`displayName`。此举同时修好**所有**基于 Button 的弹出交互锚定,并消除两条遗留控制台告警。

## 排查方法论沉淀

1. **存在 ≠ 可见。** 弹层必须用 `getBoundingClientRect()` 与视口求交验证,不能只看
   `querySelector` 是否命中。本次菜单在 DOM 检查中一直"正常",实际永久在屏幕外。
2. **Radix 在 `pointerdown` 打开菜单。** 只派发合成 `click` 的探测脚本会得到假阴性——要用
   Playwright 真实输入管线驱动。
3. **Storybook 管理页将故事嵌在 iframe 里。** Console 片段只作用于当前选中的 frame;
   对照测试管理页与直连 `/iframe.html?id=...&viewMode=story` 页可排除变量。
4. **React Flow #002/#004 告警**既可能是挂载期瞬时噪音,也可能是容器真实塌陷——先量
   `.react-flow` 实际尺寸再追查。
5. **React 18 铁律:** 函数组件不能经 props 接收 `ref`。凡作为 Radix `asChild` 子元素的
   shadcn 风格组件**必须**用 `forwardRef` 包裹。
