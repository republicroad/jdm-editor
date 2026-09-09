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
pnpm --filter @republicroad/playground dev
```

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
