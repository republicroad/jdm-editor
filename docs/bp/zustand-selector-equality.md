# BP-08：zustand 选择器相等性（useShallow vs 深比较 memoizer）

## 适用场景

任何用 `useStore(store, selector)` 订阅 zustand store 的组件；特别是从
`useStoreWithEqualityFn`（zustand/traditional）迁移到 zustand v5 零垫片 API 的代码库。

## 核心模型

React `useSyncExternalStore` 要求 **getSnapshot 引用稳定**：同一 state 下多次调用
必须返回同一引用，否则触发 "getSnapshot should be cached" 警告乃至无限渲染循环。
选择器的返回值决定所需比较器层级：

```
选择器返回什么？                       用什么
─────────────────────────────────────────────────────
原语 / store 内的同一引用            裸 useStore(store, selector)
扁平对象/数组（一层新构造，元素稳定） useStore(store, useShallow(selector))
嵌套派生结构（每拍新深层引用）        useStore(store, useMemoEquality(selector, equal))
```

`useMemoEquality` 是仓内 helper（`packages/jdm-editor/src/helpers/use-memoized-selector.ts`）：
ref + useMemo 复刻 `useSyncExternalStoreWithSelector` 的全部语义——
**hasMemo 守卫**（首拍不调比较器）+ 可插拔比较器 + 快照稳定化。

## 铁律

1. **useShallow 只救一层**：浅比较在嵌套层失配即判不等。选择器内每次
   `.map()`/`.filter()`/`getReferenceMap()` 产生的新深层引用，useShallow 兜不住。
2. **迁移不改契约**：wrapper hook 的调用方按原相等性语义编写。把深比较 wrapper
   机械换成 useShallow 等于静默改变全仓契约——先跑全量测试，渲染循环类失败
   （Maximum update depth exceeded）即契约被破坏的信号。
3. **复刻比较器必须带 hasMemo 守卫**：首拍比较器参数为 `undefined`，
   自定义比较器（如 `a.rules === b.rules`）会当场崩溃。
4. **CJS 垫片不进 dist**：`use-sync-external-store` 的深层 `require('react')`
   一旦被内联进 ESM 产物，浏览器必炸。含 @base-ui/@xyflow 依赖链的包必须为其
   保留 vite external 正则。

## 仓内实例

- `packages/jdm-editor/src/helpers/use-memoized-selector.ts`：memoizer 本体
- `dg-store.context.tsx` / `dt-store.context.tsx` / 两处 `expression-store.context.tsx`：
  wrapper 恢复可选 `equals` 参数，内部走 `useStore(store, useMemoEquality(selector, equals))`
- 决策记录：`docs/adr/006-zustand-selector-equality.md`（含 13 个失败测试的证伪过程）

## 反模式

| 反模式 | 后果 |
| --- | --- |
| 派生选择器套 useShallow 就上线 | 未覆盖路径生产期无限渲染循环 |
| memoizer 首拍直接调比较器 | 自定义比较器读属性崩溃（smoke 测试实证） |
| 移除 usese external 时只查自己的源码 | 第三方依赖链（@base-ui）仍引用 shim，内联爆炸 |
| 新代码为图省事选中全 store（`s => s`） | 任何字段变化都重渲染，比较器再准也无意义 |
