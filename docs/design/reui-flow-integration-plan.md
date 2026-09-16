# ReUI flow 融合计划：① kernel 吸收 FLOW_THEME ② flow-3 运行监控接 trace

- 日期: 2026-09-16
- 状态: **FT-1/FT-2 已执行完成（2026-09-16）**；动线与验收记录见文末
- 来源: [reui-flow-pilot.md](./reui-flow-pilot.md) 后续项 ①②；依赖 Base UI 迁移决策（[base-ui-migration-plan.md](./base-ui-migration-plan.md)）仅影响 ② 的组件风格时机，不影响 ①

## FT-1 kernel 吸收 FLOW_THEME（画布主题变量层）

### 现状（已核实）

- kernel 画布在 `graph.tsx:347` 的 `<div className="react-flow">` 内渲染 `<ReactFlow>`；
- xyflow 外观目前靠 `styles/tailwind.css` 的 `.grl-dg .react-flow__*` 逐元素手写（handle/edge-interaction 等），
  **没有 `--xy-*` 变量层**——controls/minimap/连线/选区/归因底色全部是 xyflow 出厂默认，不随主题；
- kernel token（`styles/tokens.css`）与 FLOW_THEME 的映射目标**同名同体系**：
  `--card/--primary/--muted-foreground/--border`（别名到 `--grl-color-*`，含暗色块）。

### 改动

1. 在 kernel 新增常量模块（建议 `components/decision-graph/graph/xyflow-theme.ts`），
   承载 FLOW_THEME 的 22 条 Tailwind 任意属性类（flow-1 的 flow-canvas.tsx 原样移植，注释注明出处）；
2. 应用于 `graph.tsx` 的画布 wrapper：`<div className={clsx(['react-flow'], XYFLOW_THEME)}>`；
3. 保留既有 `.grl-dg .react-flow__*` 覆盖——变量层给默认色，元素级 CSS 仍可覆盖具体部件，二者正交；
4. 归因底色 `[--xy-attribution-background-color:transparent]` 一并吸收（宿主传 `proOptions` 隐藏归因时不生效也无害）。

### 验收

- storybook：画布浅色/暗色各截一套——controls、minimap、连线、选区、句柄颜色随 token 走；
- playground graph.html / udf.html 暗色切换实测；
- `pnpm size` 不劣化（纯类名常量，可忽略）；
- kernel 发布 patch/minor 一次（视觉默认值变化，宿主升级即得主题化画布）。

### 规模

约 0.5 天（含 storybook 走查）。

## FT-2 flow-3 运行监控接 trace（决策运行画布）

### 目标

决策执行后不再只看 JSON/表格——把逐节点 trace + 审计事件渲染为 flow-3 式运行画布：
节点运行状态（成功/失败/跳过）、UDF 语义/耗时标注、失败 focus + 错误详情、一键重跑。

### 数据契约（已实测，全部现成）

`POST /v1/execute { model, input, trace: true }` →

```jsonc
{
  "result": ..., "performance": "13.0ms",
  "trace": { "<nodeId>": { "input": …, "output": …, "name": "…", "order": 1 } },
  "audit": { "decisionId": "…", "observed": [
    { "key": "…", "name": "roster", "semantics": "query", "outcome": {"hit": true}, "micros": 177.6, "code": null } ] }
}
```

### 改动

1. **安装** `@reui/flow-3`（依赖 @xyflow/react/sonner 已具备；预计需同款风格错配补丁——issue 跟踪中）；
2. **适配层** `src/shared/run-monitor-adapter.ts`：`(model, executeResponse) → flow-3 nodes/edges`
   - 节点在 trace 且无错 → `succeeded`（标 order/耗时）；
   - audit.observed 命中错误码（INVALID_PARAM / CIRCUIT_OPEN / REPLAY_JOURNAL_MISS）→ `failed`（附错误与输入快照）；
   - 不在 trace 的节点（switch 未走分支的下游）→ `skipped`；
   - customNode 卡片叠加该节点的 UDF 观察行（语义/耗时/outcome，按 trace nodeId 关联 audit.observed）；
   - edges 原样映射；
3. **落点**：udf-lab 下半区改 **Tabs（Trust Chain ｜ Run Monitor）**——两栏各自独立执行按钮
   （输入默认同夹具），监控画布用当前画布模型 + 自行发起 trace 执行，不做跨面板状态耦合；
4. **交互**：点失败节点 → flow-3 inspector 展示错误详情 + 输入快照；retry → 以同输入重发执行并重渲染。

### 验收

- 浏览器：roster 夹具运行 → 3 节点全 succeeded、UDF 行显示 `roster·query·hit=true·177.6µs`；
- 失败路径：临时把夹具输入改成非法值（或注册一个会 CIRCUIT_OPEN 的场景）→ 节点红、inspector 可 focus、retry 可用；
- trust.html / 其余页零回归；build + lint 门禁。

### 规模

约 1–2 天（安装与补丁 0.5、适配层 0.5、UI/交互 0.5、验证 0.5）。

## 顺序与依赖

- FT-1 与 FT-2 相互独立，可并行或任意先后；
- FT-2 的组件风格时机受 Base UI 迁移决策影响（base 批次落地后 flow-3 的补丁可撤销）——不阻塞启动；
- 建议顺序：FT-1（小、独立、宿主即刻受益）→ FT-2。

## 执行记录（2026-09-16）

- **FT-1 ✅**：`packages/jdm-editor/src/components/decision-graph/graph/xyflow-theme.ts`（22 条映射常量）+ `graph.tsx` 画布 wrapper 套用；kernel decision-graph 138 测试通过；实测 `.react-flow` wrapper 已携带主题类。
- **FT-2 ✅**：flow-3 安装 + 2 处补丁（ToggleGroup radix 翻译同 flow-1；`PipelineRun` 增 `initialNodes/initialEdges/replay` props，replay=false 隐藏块内置演示 Run 保护真实状态）；`run-monitor-adapter.ts` + `run-monitor.tsx` + udf-lab 下半区 Tabs（Trust Chain ｜ Run Monitor）。
- 门禁：lint ✔ / build（8 HTML）✔ / tsc 排除 blocks 后 41 条（低于基线 48；`allowImportingTsExtensions` 顺带解决了旧的 cva/lucide 报错类）。
- 块文件门禁豁免：`.prettierignore` + eslint globalIgnores + tsconfig exclude + 文件头 `@ts-nocheck`（vendored 上游原貌惯例）。
- 浏览器实测：成功路径 3 节点全 `Succeeded`（UDF 卡片标 `1438.3µs`）；失败路径（缺 value → INVALID_PARAM）`Failed 名单核验 error` 正确标红。
