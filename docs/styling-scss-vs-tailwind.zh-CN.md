# 样式体系:SCSS 与 Tailwind 对比与选型指南

> 中文为同步译文;英文原文见 [`styling-scss-vs-tailwind.md`](./styling-scss-vs-tailwind.md)。
> 本文说明本分叉为何将组件样式从手写 SCSS 迁移到 Tailwind 工具类、哪些内容确实无法用
> Tailwind *工具类* 表达,以及(为完整性补充)哪些场景下 SCSS 仍是更合适的工具。

## 1. 背景

本分叉目前维护**两套并存**的样式系统:

- 全局 `src/styles/tailwind.css`(Tailwind v4,经 `@tailwindcss/vite`),以及把 antd 派生运行时
  token(`--grl-*`)桥接为通用名称(`--border`、`--primary`…)的 `tokens.css`。所有
  shadcn/ui 与 ReUI 组件均由 Tailwind 工具类驱动。
- 约 2 700 行手写 SCSS(`dg.scss`、`dt.scss`、`ce.scss`、`expression.scss`、`function.scss`、
  `_builder-base.scss` + 各构建器、`decision-node.scss`、`styles.scss`),由 `sass` devDependency 编译。

两者都在 `src/index.ts` 导入并随 `dist/style.css` 产出。目标是把 SCSS 层收敛为
"**尽可能用 Tailwind 工具类 + 少量纯 CSS 层**",并在不损失样式能力的前提下最终移除 `sass` 依赖。

## 2. 什么是"工具类"

Tailwind 将**每条 CSS 属性映射为单个类名**,你直接在 `className` 里组合:

```tsx
// 等价于 .box { display:flex; align-items:center; gap:8px; padding:8px; }
<div className="flex items-center gap-2 p-2">…</div>
```

Tailwind 是**构建时**:扫描源码中字面量 `className="…"`,只为扫到的类生成 CSS
(`tailwind.css` 中的 `@tailwindcss/vite` + `@source '../'`)。它支持变体
(`hover:`、`dark:`、`focus-within:`、`data-[state=open]:`、`not-last:`)、伪元素
(`after:content-['']`)、任意值 `bg-[#ff0000]` / `text-[var(--x)]` / `[top:calc(50% - 1px)]`。

## 3. 对比

| 维度 | SCSS(预处理器) | Tailwind(工具优先) |
|---|---|---|
| **编写方式** | 独立 `.scss`,嵌套 + `&` + 模块系统(`@use`/`@include`) | JSX 里写类名;CSS 里用 `@theme`/`@layer`/`@custom-variant` |
| **构建** | 运行时由 `sass` 编译;完整输出 2 700 行 | 构建时扫描;只产用到的类(体积更小) |
| **复用** | `@mixin` / `@include` 共享 partial | 复用工具类字符串,或用共享 React 组件 |
| **变量** | `$vars` + `sass math`(编译期) | CSS 自定义属性(`--*`)、`@theme inline` |
| **运行时数据驱动值** | 不涉及——直接用内联 `style`/CSS 变量 | 同理:内联 `style` 或 CSS 变量;**切勿**运行时拼类名 |
| **嵌套 / 伪状态** | `&:hover`、`&::after`、`&:not(:last-child)` | `hover:`、`after:`、`not-last:`、`focus-within:` |
| **第三方 DOM 深选择器** | 易读的嵌套 | 可用 `[&_li>div+label+span]:hidden`,但难维护 |
| **计算后的 token 链** | `$h: calc($fs * $lh + …)` 定义一次复用 | 需在元素上放 CSS 自定义属性(`--b-h`) |

## 4. 什么**不能**做成 Tailwind 工具类(但可做纯 CSS)

真正的边界是"**工具类 vs 纯 CSS**",**不是 SCSS vs Tailwind**。三类落在纯 CSS 一侧,不需要 Sass:

1. **第三方 DOM 钩子。** Monaco 的行装饰只向 Monaco 生成的 DOM 传递一个*类名*
   (`function.tsx` 向 `createDecorationsCollection` 传 `className: 'grl-function__errorLineContent'`)。
   工具类挂不上去——必须有按该类名写的真实 CSS 规则。`function-debugger-log.tsx` 里
   `react-json-tree` 的内部同样如此(`li > div + label + span`、`.log__values > ul:first-of-type > li:first-of-type`)。

2. **动态计算的 token 值。** `_builder-base.scss` 用 `calc(var(--b-font-size) * var(--b-line-height) + …)`
   推导 `--b-height`/`--b-max-height`。Tailwind 工具类是静态生成的;计算值改由元素上的 CSS
   自定义属性承载。

3. **由函数参数动态生成的 SVG data-URI。** 见 §6。

这些作为薄薄的**纯 CSS 层**存在(如 `tailwind.css` 里的"第三方 DOM 钩子"段),而非 SCSS。

## 5. 运行时、数据驱动的着色(节点 / 连线 / API)

"节点类型决定连线颜色""颜色由 API 返回值决定"本质上是**运行时的 JS 计算**,理应放进**内联
`style` 或 CSS 变量**——与 SCSS/Tailwind 无关,且任何时候都可实现:

```tsx
// 连线颜色由运行时 diff/status 决定(如 custom-edge.tsx 所示)
<BaseEdge style={{
  ...(style || {}),
  stroke: match(diff)
    .with({ status: 'added' }, () => 'var(--grl-color-success)')
    .with({ status: 'removed' }, () => 'var(--grl-color-error)')
    .otherwise(() => undefined),
}} />

// 节点颜色取数据
<Node style={{ borderColor: nodeTypeColor(node.type) }} />
```

- **单个动态值** → 内联 `style`。
- **可枚举的小调色板** → 由 CSS 变量支撑的字面类名,例如 `className="fill-[var(--node-color-purple)]"`,
  运行时翻转该变量(本分叉已在 `theme.tsx` 暴露 `--node-color-*`)。
- **切勿**在运行时拼 Tailwind 类名(`text-[${color}]`)——这些类从未被扫描,生成的 CSS 里不存在。

这些都不需要重新引入 SCSS。

## 6. 唯一真正 SCSS 专有的构造

`ce.scss` 定义了 `@function lintRangeImage($color, $stroke-width)`,返回一个内联 SVG
`data:image/svg+xml,…`,其颜色与描边由参数插值。Tailwind 无法"从参数生成字符串"——但这只需要
**纯 CSS / 一个 data-URI 字符串**,并非 Sass。可预先算好静态 URI(或用一个小 JS helper)消除它,
从而仍能移除 `sass`。

## 7. SCSS 适用场景(何时它仍是更合适的工具)

客观地说,即使在 Tailwind 代码库中,少数场景确实更偏爱预处理器。当你需要工具类无法干净表达的
**编译期计算或复用**时,用 SCSS:

1. **产出值的 `@function`**——如根据入参构建 data-URI 的 `lintRangeImage($color, $w)`。这是最
   典型的 SCSS 优势(除非你改用固定 URI)。
2. **深层样式到你不拥有的第三方 DOM**,且带复杂组合选择器(`li > div + label + span`)。
   SCSS 嵌套使其可读;Tailwind 任意变体等价写法(`[&_li>div+label+span]:hidden`)难以阅读和维护。
3. **跨多个组件复用的编译期 mixin**——当你不想在多处 TSX 重复长工具类串、又不宜抽共享 React 组件时。
4. **计算后的 token 链 / 布局数学**——由少量基础 token 推导多个值(`--b-height`、`--b-max-height`),
   尤其这些值要喂给多条规则时。
5. **循环 / 条件生成**(`@each`、`@for`、`@if`)一次生成大量变体——例如构建时生成一片 shade 类。
6. **不使用 Tailwind `@theme` 的 token 系统**——若你的 token 层放在 `$vars`,并依赖 `sass math`
   做对比度/明暗调整。

**提醒:** 第 2–4 项的多数"SCSS 需求",如今在原生 CSS 嵌套普及后,用**纯 CSS**(嵌套、`@custom-variant`、
CSS 自定义属性)即可满足。只有在需要"**由函数/mixin 参数在编译期得出值**"(第 1、5、6 项)时才用预处理器;
否则优先"工具类 + 薄薄一层纯 CSS"。

## 8. 本分叉的目标形态

- **可行处** → Tailwind 工具类(布局、间距、状态、颜色)。
- **第三方 DOM 钩子 + token 运算 + data-URI** → 少量纯 CSS 层(置于 `src/styles/tailwind.css`
  或同目录的 `.css`),绝不用 SCSS。
- **运行时数据驱动值** → 内联 `style` / CSS 变量。
- **迁移顺序** → 先转最小、自包含的 `function.scss`(工具类 + 几个纯 CSS 钩子),再转相互纠缠的
  构建器模块三件套(它们共享 `_builder-base.scss`),最后是大批量 `dg.scss`/`ce.scss`/`dt.scss`,
  每完成一个 `.scss` 即删除。
- **终态** → 无 `sass` 依赖、统一样式范式、样式能力零损失。
