# 迁移 05 — react-dnd → @dnd-kit/core

> 状态:**已完成**(2026-08)。英文版为准:[`05-dnd-kit.md`](./05-dnd-kit.md)。
> 前置背景见 [`04-react-19.zh-CN.md`](./04-react-19.zh-CN.md)。

## 为什么迁

`react-dnd` 已停更(最后发布 2022-06,peer `react: ^18`)。React 19 升级后它是唯一 peer 区间
不兼容运行时的依赖,只能靠告警容忍。`@dnd-kit/core` 活跃维护,原生支持 React 16–19。

## 范围 — 四个拖拽场景全部改写

| 场景 | 文件 | 旧 API | 新 API |
|---|---|---|---|
| 决策表行交换 | `dt.tsx`、`table-row.tsx` | `DndProvider`+`useDrag/useDrop`(type `'row'`) | `DecisionTableDnd` 的 `DndContext` + `useDraggable/useDroppable`,`onDragEnd` 中交换 |
| 表达式项重排 | `expression.tsx`、`expression-item.tsx` | 同上 | `ExpressionDnd` 上下文,`onDragEnd` 交换 |
| 字段重排对话框 | `fields-reorder-dialog.tsx` | hover 时中点插入 | `onDragOver` **按 ID** 实时重排(`columnsRef` 防索引过期) |
| Excel 导入列映射 | `components/dt-excel-dialog.tsx` | 逐行 hover 中点 | 局部 `ExcelDnd`,同 section 内按 ID 移动 |

## 设计决策

- **公开 API 移除 `manager`**(破坏性):`ExpressionProps.manager`、`DecisionTableProps.manager`、
  `renderTab({ id, manager })` → `renderTab({ id })`,并删除 `dg-wrapper` 与 stories 中的
  `createDragDropManager(HTML5Backend)` 管线。dnd-kit 无需共享 manager——各组件持有局部
  `DndContext`,嵌套天然隔离。
- **方向指示保留**:`dropping-up/down` 类名与既有 SCSS 插入条不变。方向改由"被拖矩形中心 vs
  目标矩形中心"计算(`helpers/dnd.ts#getDropDirection`),替代 react-dnd 的指针增量,视觉等效。
- **传感器**:仅 `PointerSensor`,`{ activationConstraint: { distance: 4 } }` 保证行内输入框
  点击不会误触发拖拽。
- **语义保真**:表格/表达式保持"落点才交换"(每次手势一次位移);字段对话框与 Excel 映射保持
  实时重排,与旧 UX 一致。
- 拖动时节点跟随光标(dnd-kit 默认 transform);旧 HTML5 幽灵图预览不复存在,源节点按既有
  opacity 规则变淡。后续需要悬浮预览可加 `DragOverlay`。

## 真实指针测试带出的额外修复

`.expression-list__item__th--order`(表头装饰格)实际算出 **63px 高**(`height:100%` 落在
auto 高度网格父级上),静默盖住了第一行的拖拽柄——真实鼠标拖表达式项在本次迁移**之前就已
失效**;此前探测用合成事件绕过了命中测试所以从未发现。修复:表头单元格统一
`pointer-events: none`。

## 验证

typecheck · vitest 37/37 · test-storybook 55/55 · Playwright **真实鼠标**拖拽:表达式项重排
(顺序变化、出现 `dropping-down`)与表格行交换(1→3 行)均通过、零控制台错误。字段对话框与
Excel 映射共用已验证的 ID 模式,由 story 冒烟覆盖。

## 经验沉淀

1. 合成事件探测会绕过命中测试——拖拽 UX 必须用真实指针管线验证,才能暴露覆盖层/z-index 死区。
2. 迁移 hover 式重排逻辑时,移动操作务必以稳定 **ID** 为键而非索引:首次重排后,dnd-kit 持续
   `onDragOver` 里携带的拖起时索引即刻过期。
