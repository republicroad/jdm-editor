# JDM Playground

仓内集成验证与演示壳：以**源码直通**方式装配 `@republicroad/jdm-editor`
（DecisionGraph / DecisionTable / 内置模拟器）与 `@republicroad/jdm-appshell`
（IndexedDB 持久化 / VersionHistoryPanel / restoreVersion）。

价值（见 `docs/archive/hostapp/appshell-plan.md` §6）：

- **自包含集成验证面**——宿主 bump gitlink 前即可在树内发现问题；
- 演示 / onboarding：保存到 IndexedDB、版本历史、命名版本、恢复即前进、
  画布 diff 对比（`diffBaseline`）开箱即用。

## 启动

```bash
pnpm install
pnpm --filter @republicroad/playground dev   # 或根目录 pnpm dev（同时拉起 demo-server）
```

## MPA 结构（Vite 多页应用）

`index.html` 是**目录页**，每个 playground 实例是独立 HTML 入口（独立加载、
互不拖累；monaco 只进 graph / table 两个入口的共享 chunk）：

| 入口         | 实例           | 内容                                                                |
| ------------ | -------------- | ------------------------------------------------------------------- |
| `index.html` | 目录           | 各实例导航卡片                                                      |
| `graph.html` | Decision Graph | 编辑器 + 模拟执行 + 版本历史 + Server run + ocean 皮肤槽位演示      |
| `table.html` | Decision Table | business 模式决策表                                                 |
| `grid.html`  | Data Grid      | ReUI DataGrid（排序 / 过滤 / 列徽标）                               |
| `reui.html`  | ReUI Showcase  | Timeline / Sortable / 决策模型层级树（读共享 IndexedDB 的已保存图） |
| `trust.html` | Trust Chain    | 执行 + 审计 → 确定性回放 → 影子对比（需 demo-server :8787）         |

新入口三步：根下加 `<name>.html` → `src/entries/<name>.tsx` 挂载页面组件 →
`vite.config.ts` 的 `build.rollupOptions.input` 登记该项。

实例间共享面：graph 实例「Save」写 IndexedDB（`playground-graph`），
trust / reui 实例经 `usePersistedGraph` 读同一份图——跨实例延续编辑成果。
共享壳与夹具在 `src/shared/`（InstanceShell / ThemeToggle / monaco-setup / fixtures）。

## 覆盖能力

- DecisionGraph：拖拽建图、内置模拟器面板
- DecisionTable（business 模式）：自然语言单元格
- 版本历史：Save 写入 IndexedDB → Version history 打开面板
  （版本列表 + diff 摘要 + 恢复即前进 + 命名版本）

## 注意

- 两个 workspace 包经 vite alias **源码直通**——不要改回 dist 解析
  （pnpm 硬链接副本会在每次 `vite build` 后陈旧，见
  `docs/troubleshooting.md` 案例 8）。
- monaco-editor 由 playground 自行安装（kernel peer 契约），worker 经
  vite `?worker` 导入接线。
