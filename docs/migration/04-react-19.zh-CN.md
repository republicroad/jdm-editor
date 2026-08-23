# 迁移 04 — React 18 → 19(含 zustand 5)

> 状态:**已完成**(2026-08)。运行时已在 `reui` 分支升级;库的 peer 依赖刻意保持不变。
> 英文版为准:[`04-react-19.md`](./04-react-19.md)。
> 前置背景见 [`03-post-migration-fixes.zh-CN.md`](./03-post-migration-fixes.zh-CN.md)。

## 决策

| 主题 | 决策 |
|---|---|
| 目标版本 | React `19.2.8` + `@types/react` `^19.2.18`(升级时点最新稳定) |
| 库 peer | **保持 `"react": ">= 18"`** —— dist 为编译产物、未用任何 19-only API;双运行时实测验证 |
| 组件写法 | 全库继续 `forwardRef` 等 React-18 兼容模式(peer 含 18 期间必须如此) |
| zustand | `^4.5.5` → `^5.0.15`;废弃的 `store(selector, equalityFn)` 调用迁移到 `zustand/traditional` 的 `useStoreWithEqualityFn` |
| react-dnd | 维持 `16.0.1`。项目已停更(最后发布 2022-06,peer `^18`)但运行时兼容 19;接受 peer 告警。替换为 `@dnd-kit/core` 列入后续迁移 |

## 版本变更

| 包 | 之前 | 之后 |
|---|---|---|
| react / react-dom(dev) | 18.3.1 | 19.2.8 |
| @types/react | 18.3.11(钉死) | ^19.2.18 |
| zustand | ^4.5.5 | ^5.0.15 |
| react-dnd | 16.0.1 | 不变(容忍 peer 告警) |

注:`@types/react-dom` 在本次迁移前就已是 `^19.x`(历史混搭)。

## 代码适配

1. **zustand v5 移除 `(selector, equals)` 双参调用**——六处 hook 调用点
   (`dg-store.context`、`dt-store.context`、`expression-store.context`)迁移到
   `useStoreWithEqualityFn(store, selector, equals)`。
2. **严格 getSnapshot 缓存**:`expression-command-bar.tsx` 用对象字面量 selector 直接订阅裸
   store → React 19 下 "Maximum update depth exceeded"。拆成两个原始值 selector。
3. **全局 `JSX` 命名空间移除**——`dt-empty.tsx` 改用 `import type { JSX } from 'react'`。
4. **`React.VFC` 移除**——`spaced-text.tsx` 换成 `React.FC`。
5. **`React.FC` 返回类型含 `Promise`**——面板类型从 `renderPanel?: React.FC` 改为
   `renderPanel?: () => React.ReactNode`,调用处去掉实参。
6. **ref 回调不得返回值**(@types/react 19):react-dnd 的 `ConnectDragSource` 不再能直接赋给
   `ref` —— 用花括号回调包裹(`table-row.tsx`、`expression-item.tsx`)。

## 验证门(全绿)

- `tsc --noEmit`、vitest 37/37、storybook 生产构建、test-storybook **55/55**
- 节点 ⋮ 菜单锚点探测:内容贴着触发器下方渲染且在视口内
- 原生 DataTransfer 事件序列拖拽回归:决策表行拖出方向指示类;表达式项拖出 dropping 类;
  零页面错误
- 控制台:graph/table/expression 各 story 零运行时错误(v4 时代的 zustand create DEPRECATED
  告警随 v5 消失)
- **双宿主冒烟**:最小 Vite 宿主经 `pnpm add file:` 消费构建产物,分别在
  **react 18.3.1** 与 **react 19.2.8** 下挂载 DecisionGraph、渲染一致、零控制台错误;
  以 `@types/react@18.3.11`(skipLibCheck,标准消费姿势)`tsc --noEmit` 通过

## 已知遗留

- 安装期 peer 告警(良性、不阻断):`use-sync-external-store` / `transition-hook` 声明的 react
  区间过旧;`@hookform/resolvers` 的 zod 区间不匹配**早于本次迁移即存在**。
- Storybook docgen 对 `ExpressionStore['debug']` 记录 `UnknownArgTypesError`(仅开发期
  argTypes 推断,无运行时影响)。
- react-dnd 仍是维护停滞依赖——替换工作已列为后续迁移。

## 经验沉淀

1. **换 React 版本后必须重启 Storybook 开发服**:Vite 依赖优化器会在首个请求时重新打包;
   test-runner 若撞进该窗口会集体 `page.goto` 超时,极易误判为用例失败。
2. zustand v5 移除 equality-fn 重载正是 v4 控制台 DEPRECATED 消息所指——迁到
   `zustand/traditional` 一并解决。
3. React 19 类型把若干过去静默的模式变成硬错误(FC 可异步返回、ref 回调返回值、全局 JSX
   命名空间);只要代码库本就规避 `findDOMNode`/字符串 ref/`defaultProps`,剩余就是少量机械性
   TS 收尾而非运行时意外。
