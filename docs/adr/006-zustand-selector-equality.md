# ADR-006：zustand 选择器相等性——弃用 zustand/traditional，本地深比较 memoizer 取代

## 状态
accepted（2026-09）

## 背景

kernel 的 4 个 store context（dg-store、dt-store、expression、custom-function-table）的
hook 契约自 React 19 迁移（Migration 04）起是：`useStoreWithEqualityFn(store, selector,
fast-deep-equal)`。该实现来自 `zustand/traditional`，其底层是
`use-sync-external-store/with-selector`（usese shim）。

usese shim 的问题：深层 CJS 实现（`require('react')`）一旦被 bundler 内联进 ESM dist，
在浏览器中崩溃；因此 kernel/appshell 的 vite external 必须长期为其保留正则（S011）。
且 usese 是 React 18→19 过渡期的垫片包，React 19 开发路线下属于应剔除的依赖。

zustand v5 官方推荐的替代是 `useShallow`（`zustand/react/shallow`，零额外依赖）。

## 尝试与证伪记录

**纯 `useShallow` 替换（2026-09-17）**：将 4 个 wrapper 改为
`useStore(store, useShallow(selector))` 后，13 个测试失败
（decision-table 管线 6、diff markers 1、custom-node 锚点 4、custom-node tab 1、
graph mount 1）。两类故障：

1. **快照不稳定 → 无限循环**（"The result of getSnapshot should be cached" +
   "Maximum update depth exceeded"）。根因：kernel 存在大量派生选择器，每次调用
   构造新嵌套引用（如 `table-default-cell.tsx` 的 `getReferenceMap(trace, debugIndex)`
   每次重建引用表）。深比较判定相等，浅比较在嵌套层失配 → 快照永不稳定。
2. **该失败模式无法靠枚举调用点根治**：wrapper 的公开契约是「深比较稳定化」，
   全仓几十个调用点按此契约编写；未覆盖的派生选择器构成潜在生产期渲染循环风险。

**首次 memoizer 实现的回归**：按 `useShallow` 源码同构实现 ref + useMemo memoizer 后，
smoke 测试暴露第二处语义差异——自定义比较器（如 `table.tsx` 读取 `a.rules`）在
首次调用收到 `undefined` 即崩溃。`useSyncExternalStoreWithSelector` 内置 hasMemo
守卫（首拍不调比较器），复刻时必须一并保留。

## 备选方案

| 方案 | 优势 | 劣势 |
| --- | --- | --- |
| 保留 zustand/traditional + usese external | 零改动 | React 19 路线仍背垫片包；external 正则长期保留 |
| 纯 useShallow + 逐个修派生选择器 | 官方推荐、零自定义代码 | 需审计全部调用点；漏网选择器 = 生产期渲染循环 |
| 本地 `useMemoEquality`（ref + useMemo + 可插拔比较器） | 语义与原契约完全一致；甩掉 usese 与 zustand/traditional | ~25 行自维护代码（zustand 文档认可的官方模式） |

## 决策

1. 引入 `src/helpers/use-memoized-selector.ts`：`useMemoEquality(selector, equalityFn)`，
   复刻 `useStoreWithEqualityFn` 全部语义（hasMemo 守卫 + 可插拔比较器 + 快照稳定化）。
2. 4 个 wrapper 恢复原签名（可选 `equals` 参数，默认 `fast-deep-equal/es6/react`），
   内部改走 `useStore(store, useMemoEquality(selector, equals))`。
3. kernel 移除 `zustand/traditional` 依赖面与 `use-sync-external-store` 声明
   （package.json + catalog + kernel vite external）。
4. `useShallow` 保留为**新代码的合法选项**：仅当选择器返回扁平对象/原语/稳定引用时可用。
5. appshell 的 usese external 正则**保留**：kernel 不再经过它，但 appshell 自带
   `@base-ui/react` 依赖链仍引用 usese shim，内联同样崩溃。

## 后果

- kernel dist 零 `zustand/traditional` / usese 引用（已被构建产物 grep 验证）
- kernel 447 测试全绿；appshell 构建 + dist 检查通过
- usese 仍在 lockfile 中，但全部来自第三方自带依赖
  （storybook→1.7.0、@base-ui→1.6.0、@xyflow→1.2.2），本仓不再声明
- 后续 Base UI 迁移若移除 @base-ui，appshell 的 usese external 可一并退役
