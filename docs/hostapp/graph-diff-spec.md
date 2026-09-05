# Graph Diff 立项规格（版本对比）

> 状态：**立项待实现**（由 editor 宿主会话移交，2026-09-05）。
> 消费方：VersionHistoryPanel（packages/appshell）的版本对比入口 + editor 宿主（republicroad/editor）。
> 本规格含算法选型/API 形态/渲染分期/验收标准；**文件清单由实现者按仓内布局自定**。

---

## 1. 背景与目标

规则历史功能（第五十~五十二批）已落地快照化版本池。本立项为版本对比能力：

- **P1（面板变更清单）**：任选两个版本 → 正确列出节点/边的增删改清单（面板内渲染）
- **P2（画布高亮）**：打开某版本时叠加差异标记（变更节点高亮、删除节点灰显、新增节点标记）

消费方：editor 宿主（republicroad/editor）的版本历史面板；任何嵌入本库的宿主。

---

## 2. 算法选型

| 方案 | 原理 | 判定 |
| --- | --- | --- |
| **按 id 的结构化 diff（推荐）** | nodes/edges 各建 id → 对象 map；added = b 有 a 无；removed = a 有 b 无；modified = 双方都有且内容不等（逐字段或 JSON 比较） | O(n)、零依赖、结果直接映射 UI（增/删/改三集）；图模型天然以 id 为身份 ✓ |
| jsondiffpatch / fast-json-patch | 通用 JSON patch | ❌ 通用 patch 对图语义噪声大（位置移动被记为数组操作） |
| 图编辑距离（GED） | NP-hard 最优匹配 | ❌ 杀鸡用牛刀 |

**推荐实现要点**：
- 节点以 `id` 为身份；modified 判定 = 内容深比较（`JSON.stringify` 或逐字段），变更明细可输出字段级差异（可选增强）
- 边以 `id` 为身份；边的内容变化独立于节点
- 纯函数、无副作用、无 React 依赖（vitest 直接可测）

---

## 3. API 形态

```ts
export type GraphNodeChange = {
  id: string;
  name?: string;        // 变更后名称（便于展示）
  kind?: string;        // customNode kind（便于按节点类型显示图标）
  fields?: string[];    // 变更字段名列表（可选增强）
};

export type GraphDiff = {
  addedNodes: GraphNodeChange[];      // b 有 a 无
  removedNodes: GraphNodeChange[];    // a 有 b 无
  modifiedNodes: GraphNodeChange[];   // 双方都有且内容不等
  addedEdges: GraphNodeChange[];
  removedEdges: GraphNodeChange[];
  modifiedEdges: GraphNodeChange[];
  unchanged: boolean;                 // 便捷位：全部为空 = true
};

export function computeGraphDiff(a: DecisionGraphType, b: DecisionGraphType): GraphDiff;
```

- 输入：两版图 JSON（`{nodes, edges}` 形态，与 DecisionGraph value 同构）
- 纯函数、无副作用；`unchanged` 供面板显示"无变化"

---

## 4. 渲染路径分期

### P1 — 面板变更清单（appshell 层）

VersionHistoryPanel 扩展：选中某版本时显示**与前一版本的差异摘要**
（`+3 节点 / −1 节点 / ~2 节点修改`，展开列出逐条）。appshell 新增
`computeGraphDiff` 的 re-export 或独立工具入口。

### P2 — 画布高亮对比（内核决策图渲染层）

打开某版本时叠加差异标记：变更节点高亮描边、删除节点灰显+删除线、
新增节点绿色标记。复用内核 DiffIcon / decision-table diff 染色基建
（0.3.0 已有 expression diff 先例）。需要 DecisionGraph 支持
"diff 模式"（传入基线版本 + 当前版本 → 渲染标记）。

---

## 5. 验收标准

1. 任选两版本 → 清单正确列出节点/边增删改（人工构造用例验证）
2. 内容相同、仅位置变化的版本对 → `unchanged = true`
3. 空 diff → 面板显示"无变化"
4. 纯函数单测覆盖：增/删/改/混合/空图 各用例
5. P2（如实现）：画布高亮与清单一致

---

## 6. 文件清单

由实现者按仓内布局自定。建议方向：

```
packages/jdm-editor/src/components/decision-graph/diff/
  ├── compute-graph-diff.ts    # 纯函数引擎
  ├── types.ts                 # GraphDiff 等
  └── __tests__/               # vitest
packages/appshell/src/components/version-history/
  └── （P1 清单渲染扩展）
```

---

## 7. 宿主接线示例（editor 侧）

```ts
import { computeGraphDiff } from '@republicroad/jdm-editor';
const diff = computeGraphDiff(previousVersionContent, currentContent);
// 传入 VersionHistoryPanel 扩展 props 或画布 diff 模式
```
