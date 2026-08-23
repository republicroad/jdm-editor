# React Compiler PoC — 采用评估

> 状态:**仅评估**(2026-08),未改动任何产品代码。英文版为准:[`react-compiler-poc.md`](./react-compiler-poc.md)。

## 测量方式

以 `eslint-plugin-react-compiler@19.1.0-rc.2` 扫描全部
`packages/jdm-editor/src/**/*.{ts,tsx}`,专用配置见
[`eslint.react-compiler.mjs`](../eslint.react-compiler.mjs):

```bash
pnpm exec eslint -c eslint.react-compiler.mjs "packages/jdm-editor/src/**/*.tsx"
```

## 结果

| 指标 | 数值 |
|---|---|
| 扫描文件 | ~180 个 tsx |
| 违规文件 | **2** |
| 违规总数 | **3** |

| 位置 | 违规 | 性质 |
|---|---|---|
| `decision-table/table/table.tsx:60` | 修改 hook 入参(`scrollContainerRef.current = el`) | 刻意的命令式 ref 外抛 |
| `table.tsx:288` | 修改 props(`scrollApiRef.current = {...}`) | 公共 `TableScrollApi` 契约 |
| `dg-store.test.tsx:14` | 重赋值外部变量 | 测试文件,编译器运行时本就忽略 |

结论:**代码库已基本达到 Compiler 就绪**。两处真实违规是同一模式——父级传入的 ref 对象由子组件
写入(公共 `scrollApiRef` API 的文档化逃生门)。启用时给 `Table` 加 `"use no memo"` 指令
(或改造成 `useImperativeHandle`)即可,各一行。

## 启用要点(本次未执行)

- 构建栈限制:本库使用 `@vitejs/plugin-react-swc`,而 Compiler 以 Babel 插件形态发布
  (`babel-plugin-react-compiler`)。可选:切换到 `@vitejs/plugin-react`(babel),或采用 swc 实验通道
  (`@vitejs/plugin-react-swc` ≥4.x 的 `experimental.reactCompiler`)。
- 运行时条件已满足:React 19.2.8。
- 建议节奏:①先把 `eslint.react-compiler.mjs` 接入 CI 作 warning,保持违规清零;②待
  Storybook/Vite 工具链稳定后,在 decision-graph 与 decision-table story 上试用并对比交互
  profiling。

## 建议

择机两步走:先 CI warning 化防回潮;再试运行评估收益。预期收益温和(状态层已精细使用 zustand
selector),定位为工程卫生项而非性能杠杆。
