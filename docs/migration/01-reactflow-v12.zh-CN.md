# 迁移 01 —— ReactFlow 11 → @xyflow/react 12

> 状态:**已在本分叉实施**。英文原版:[`01-reactflow-v12.md`](./01-reactflow-v12.md)。
> 范围:仅 `packages/jdm-editor`。图语义无行为变化。

## 为什么迁移

`reactflow@11` 已进入维护模式;v12(`@xyflow/react`)是持续开发的 TypeScript 重写版。
本分叉需长期自持,继续停留在旧版视图库是不必要的风险。

## 影响面(经代码检索核实)

13 个文件从 `reactflow` 导入;3 处调用 `instance.project()`;2 个文件引入其 CSS。

| 文件 | 用到的 API | 所需改动 |
|---|---|---|
| `graph/graph.tsx` | ReactFlow、Background、Controls、ControlButton、SelectionMode、useNodesState/useEdgesState、getOutgoers、类型;CSS;`project()` ×2 | import + CSS + `screenToFlowPosition()` |
| `hooks/use-graph-clipboard.ts` | Node/ReactFlowInstance/XYPosition 类型;`project()` ×1 | import + `screenToFlowPosition()` |
| `context/dg-store.context.tsx` | 仅类型:EdgeChange、NodeChange、ReactFlowInstance、useEdgesState/useNodesState | import |
| `custom-edge.tsx` | BaseEdge、EdgeLabelRenderer、getBezierPath、EdgeProps | import |
| `dg-wrapper.tsx` | ProOptions;CSS | import + CSS |
| `dg-util.ts` | Edge/Node 类型、MarkerType | import |
| `dg.tsx` | ReactFlowProvider | import |
| `helpers/traversal.ts` | Edge/Node 类型、getIncomers/getOutgoers | import(+泛型签名) |
| `nodes/graph-node.tsx` | Handle、Position、HandleProps | import |
| `nodes/custom-node/index.tsx` | XYPosition | import |
| `graph/graph-components.tsx` | XYPosition | import |
| `nodes/specifications/specification-types.ts` | NodeProps(经由 `MinimalNodeProps`)| import |
| `nodes/specifications/switch.specification.tsx` | Handle、Position | import |

## 实施步骤

1. **依赖替换**:`packages/jdm-editor/package.json` 移除 `reactflow@11.11.4`,新增
   `@xyflow/react@^12`;重新安装。
2. **机械替换**:`'reactflow'` → `'@xyflow/react'`;
   `'reactflow/dist/style.css'` → `'@xyflow/react/dist/style.css'`。
3. **API 适配**:
   - `ReactFlowInstance.project({x,y})` → `ReactFlowInstance.screenToFlowPosition({x,y})`
     (v12 更名,屏幕坐标→画布坐标语义不变)。
   - `NodeProps` 引入泛型(`NodeProps<NodeType extends Node = Node>`);裸用仍合法,
     故 `MinimalNodeProps = Pick<NodeProps, 'id'|'data'|'selected'>` 无需改动即可编译。
   - `getOutgoers`/`getIncomers` 对节点数据泛型化;现有 `Node<any>` 调用可直接编译。
4. **已合规模式**(无需处理):模块级记忆化的 `nodeTypes`/`edgeTypes`(v12 要求引用稳定)、
   经 `onNodesChange/onEdgesChange` 的受控模式、peer 依赖 React ≥18、
   `deleteKeyCode={null}`、`snapToGrid/snapGrid`、`connectionRadius`、
   `selectionMode={SelectionMode.Partial}`、`elevateNodesOnSelect`、Controls/ControlButton/Background ——
   在 v12 中均同名存在。
5. **验收门禁**:根目录 `pnpm build` + `pnpm typecheck` 通过;Storybook 冒烟:
   连线(防环/防重)、拖拽建节点、框选+删除确认、复制/粘贴/副本快捷键、模拟器运行与 trace 高亮、
   序列化后恢复 viewport/tabs。

## 回滚

改动集中于单个 commit(一个包的 package.json + 13 个源文件);revert 即回到 v11。
