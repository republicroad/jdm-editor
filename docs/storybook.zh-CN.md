# Storybook 指南

> 本库中 Storybook 的配置、运行、测试与扩展方式。
> 英文正典:[`storybook.md`](./storybook.md)。

## 快速启动

```bash
# Dev server(前台运行,Ctrl+C 停止)
corepack pnpm@10 --filter @republicroad/jdm-editor storybook
# → http://localhost:9009

# 构建静态站点
corepack pnpm@10 --filter @republicroad/jdm-editor build:storybook

# 构建 + 静态服务 + 运行全部交互测试(CI 级)
corepack pnpm@10 --filter @republicroad/jdm-editor test:storybook
```

## 配置

### `.storybook/main.ts`

| 配置项 | 值 | 说明 |
|---|---|---|
| `stories` | `../src/**/*.stories.tsx` | 自动发现 `src/` 下所有 story 文件 |
| addons | links, dark-mode, docs, mcp | 暂无 a11y 插件 |
| `staticDirs` | `zen-engine-wasm/dist → /zen-engine-wasm` | WASM 二进制以稳定路径服务,供 `preview.tsx` 加载 |
| framework | `@storybook/react-vite` (strictMode) | Vite 打包 |
| `viteFinal` | Tailwind CSS v4 插件 + `@/` 别名 | 确保 Tailwind 在 Storybook 中的编译方式与库构建一致 |

### `.storybook/preview.tsx`

全局装饰器实现了**规范宿主形态**:`.grl-root` 包裹 `JdmConfigProvider`,再包裹 story。这意味着:

- 每个 story 走的是**作用域注入路径**(P3)——变量以内联属性设置在岛容器上,`data-mode` 也挂在那里。
- 所有 Radix portal 挂载在岛**内部**(经 `GrlContainerProvider`)。
- `storybook-dark-mode` 插件的暗色切换会翻转 Provider 的 `mode`,沿 `--grl-*` → 语义变量链级联生效。
- 装饰器注入 `<style>` 设置 `html` 背景色(随模式切换)并将 `body`/`#storybook-root` 固定为 `height: 100vh/100%`——虚拟化表格与全高代码编辑器必需(见 [`storybook-height-chain.md`](./storybook-height-chain.md))。

### `.storybook/preview-head.html`

设置 `#root { padding: 20px }` 提供视觉留白。

### `.storybook/manager-head.html`

设置管理界面标签页标题为 "JDM Editor" 并挂 favicon。

## Story 清单(57 stories / 9 文件)

| 文件 | Stories | 要点 |
|---|---|---|
| `components/code-editor/ce.stories.tsx` | Uncontrolled, Controlled, FullHeight, NoStyle, **LazyParity**, Debug, LivePreview | **LazyParity** 是几何回归守卫:单击进编辑 + 展示↔编辑首行文本盒 dX/dY ≤ 0.5px + padding 相等 |
| `components/decision-table/dt.stories.tsx` | Controlled, Uncontrolled, CustomRenderer, StressTest, BusinessMode, BusinessModeDictionaries | **StressTest** 渲染 10k 规则;用 `tableHeight='90vh'` 约束虚拟izer窗口 |
| `components/decision-graph/dg.stories.tsx` | Controlled, Uncontrolled, Disabled, Extended, CustomNode, InputFormCustomNode, UnknownCustomNode, **Simulator**, Diff, View, Serialize, BusinessMode | 功能最丰富的组件 |
| `components/expression/expression.stories.tsx` | Uncontrolled, Controlled | |
| `components/function/function.stories.tsx` | Uncontrolled, Controlled, WithError | |
| `components/code-editor/business/expression-builder.stories.tsx` | 15 个(auto-type, string-type, number-type, boolean-type, date-type, enum-type, dictionary-enum 等) | |
| `components/code-editor/business/standard-expression-builder.stories.tsx` | (1 个) | |
| `components/theming.stories.tsx` | **SeedsPlayground** | 交互式种子→派生 token 可视化器,带 `--grl-*` JSON 复制功能 |
| `components/isolation.stories.tsx` | **Isolation** | 双岛隔离验证台(Batch S4):明色默认岛与暗色紫种子岛并排 + 岛外宿主样式探针 |

### Story ID 参考

Story ID 由文件路径和导出名派生(kebab-case):

| Story 文件 | ID 前缀 | 示例 |
|---|---|---|
| `ce.stories.tsx` | `codeeditor--` | `codeeditor--lazy-parity` |
| `dt.stories.tsx` | `decision-table--` | `decision-table--controlled` |
| `dg.stories.tsx` | `decision-graph--` | `decision-graph--controlled` |
| `expression.stories.tsx` | `expression--` | `expression--uncontrolled` |
| `function.stories.tsx` | `function--` | `function--uncontrolled` |
| `expression-builder.stories.tsx` | `expressionbuilder--` | `expressionbuilder--boolean-type` |
| `standard-expression-builder.stories.tsx` | `standard-expression-builder--` | |
| `theming.stories.tsx` | `theming--` | `theming--seeds-playground` |
| `isolation.stories.tsx` | `theming-isolation--` | `theming-isolation--isolation` |

## 交互测试(`test:storybook`)

```bash
pnpm --filter @republicroad/jdm-editor test:storybook
```

这是一个三段流水线,经 `concurrently` 并行运行:

1. **SB**: `storybook build -o docs --quiet` → 静态构建到 `docs/`
2. **Serve**: `http-server docs -p 9009 --silent`(要求 9009 端口空闲)
3. **TST**: `wait-on tcp:127.0.0.1:9009 && test-storybook --url http://127.0.0.1:9009`

所有含 `play()` 函数的 story 都会在无头 Chromium 中执行。

### play() 函数

| Story | 断言 |
|---|---|
| `LazyParity` | 单击进编辑;展示↔编辑 content/line 盒 dX/dY ≤ 0.5px;padding 相等;确定性展示态引导(自动聚焦时强制 blur) |

### 已知坑

- **端口冲突**:运行 `test:storybook` 前需停掉 9009 端口上的 dev server。
- **首帧自动聚焦**:Storybook dev 画布可能在 `play()` 运行前自动聚焦 story 标签,导致 lazy 编辑器提前进入编辑态。LazyParity 引导通过 `document.activeElement.blur()` 处理。
- **jsdom vs 真实浏览器**:`test:storybook` 在真实 Chromium 中运行,`pnpm test` 使用 jsdom。Radix Select 在 jsdom 中需要 pointer-capture polyfill,在 Chromium 中不需要——见 `primitives-keyboard.test.tsx` 的 jsdom shim。

## 高度链

百分比高度链(`height: 100%`)在 Storybook iframe 内部会静默失效,除非每个祖先都有显式高度。装饰器固定了 `#storybook-root { height: 100% }`,StressTest story 使用 `90vh`。完整调查:[`storybook-height-chain.md`](./storybook-height-chain.md)。

## 作用域注入(.grl-root)在 Stories 中的表现

装饰器的 `.grl-root` 包裹使每个 story 走**作用域注入路径**(P3):`--grl-*` 变量以内联属性设置在岛容器上,`data-mode` 挂在那里,Radix portal 经 `GrlContainerProvider` 定位到岛内。

**多岛测试**:要验证岛隔离,在 story 内渲染自己的 `.grl-root` + `JdmConfigProvider`(`Isolation` story 即是)。最内层 `.grl-root` 在作用域解析中获胜。**不要在没有自己的 `.grl-root` 包裹的情况下嵌套 Provider**——那样内层 Provider 会把外层岛解析为容器。

## 暗色模式

`storybook-dark-mode` 插件提供工具栏切换按钮。装饰器经 `useDarkMode()` 读取并将 `mode` 传给 `JdmConfigProvider`。暗色模式翻转岛容器上的 `[data-mode]`,沿语义变量桥(`tokens.css`)级联生效。
