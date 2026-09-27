# playground UDF Lab 计划：udf.html Custom Nodes 节点工作台

- 日期: 2026-09-15
- 状态: ✅ 已落地并浏览器验证（2026-09-27 A1 走查）：UDF-1~5 全部交付（e2c87e62 + d2518eb0），
  实测记录见文末 §6
- 定位: editor 项目 `decision-simple` 页的缩小复刻；playground 第七个 MPA 实例
- 目标: 编排（自定义节点面板）→ 仿真（simulator 全链路）→ Trust Chain（审计/回放/影子）单页闭环

## 0. 已确认的地基（零新造轮子）

| 事实 | 位置 |
| --- | --- |
| 注册表已能导出 schema：`udfFunctionSchemaNamespaces(): CustomNodeNamespace[]` | `packages/zen-udf/src/register.ts:379` |
| `useCustomNodes({ schemaSource })` 已公开导出；默认拉 `/api/custom-nodes/schema`，可传 URL；内置 4 专用节点（roster/crypto/http_request/current_date，经 `overriddenFunctions` 客户端去重）+ legacy UDF + schema 驱动节点 | `packages/appshell/src/index.ts:2`、`src/hooks/useCustomNodes.ts` |
| `SkinnedDecisionGraph` 继承 `DecisionGraphProps`，`customNodes` prop 直通 | `packages/appshell/src/components/skinned-decision-graph.tsx:23` |
| 仿真面板 handler 现成：`createExecuteSimulate(baseUrl)` POST `/v1/execute`（trace:true） | `packages/appshell/src/shell/execute-simulate.ts:45` |
| customNode 图 JSON 契约：`{ type:'customNode', content:{ kind:'UDF', config:{ expressions:[{ key, value:'udf名;;zen表达式' }] } } }`；`;;` 分隔为正则感知切分 | `packages/zen-udf/src/decision-audit.test.ts:13`、`engine.ts:619,625` |
| demo-server CORS 全开；import 包根即装载 contrib 参考域（roster/crypto/http/ip_location/rate_window/debugui/custom_list_query） | `apps/demo-server/src/app.ts`（`app.use('*', cors())`） |
| demo-server 现有路由：/healthz、/v1/validate、/v1/execute、/v1/replay、/v1/shadow；**无 schema 端点；无演示名单注册** | 同上 |

结论：新实例的核心接线全部是现成 API 的组装，新增代码集中在 schema 端点、Panel 抽取、页面组装、夹具四块。

## 1. 工作分解

### UDF-1 demo-server schema 端点（~10 行）

- `app.ts` 增加：`GET /v1/custom-nodes/schema` → `c.json(runtime.registry.udfFunctionSchemaNamespaces())`。
- 验证：`curl :8787/v1/custom-nodes/schema` 返回数组、tools 带.parameters/returns schema；`scripts/probes/demo-server-live.mjs` 补一条断言。
- 不做 tools 平铺端点（namespaces 已满足 `parseCustomNodeSchemaPayload` 契约）。

### UDF-2 TrustChainPanel 抽取（纯重构，无行为变化）

- `src/trust-chain-page.tsx` → 三步卡片（①执行审计 ②回放 ③影子）抽到 `src/shared/trust-chain-panel.tsx`，导出 `TrustChainPanel({ model })`（去页级 h2/内边距）。
- `TrustChainPage` 变薄壳：标题 + `<TrustChainPanel model={model} />`；trust.html 行为不变（回归验证一次）。

### UDF-3 演示夹具 + demo 名单（~40 行）

- `src/shared/udf-fixtures.ts`：2–3 个含 customNode 的样例图（形态照 §0 契约手写）：
  - A 零参节点（current_date）：最小可用闭环；
  - B roster 名单查询：**demo-server 启动时注册演示名单**（app.ts 加 ~5 行 `registerRoster`），input 形如 `{ roster:'demo_block', value:'1.2.3.4' }`；
  - C（可选）crypto。
- 页头「样例 ▼」下拉一键载入画布。
- 执行时每条夹具对 demo-server 实测；**画布拖一个 schema 驱动节点导出 JSON 与手写形态对照**（`/v1/validate` 兜底），格式不符以画布产出为准修正夹具。

### UDF-4 udf.html 实例（核心，~130 行）

- 文件：`udf.html` + `src/entries/udf.tsx`（setupMonaco）+ `src/udf-lab.tsx`。
- **接线（对齐 decision-simple，缩小复刻的本体）**：`EditorShellProvider` 包裹 +
  内部 `useEditorShell()` 取 `customNodes` / `schema` / `ready` / `runSimulate`：
  ```tsx
  <EditorShellProvider options={{
    schemaSource: `${DEMO_SERVER}/v1/custom-nodes/schema`,
    simulate: createExecuteSimulate(DEMO_SERVER),
    persistence: createIndexedDbAdapter(),   // 可选：演示 shell 持久化契约
  }}>
  ```
  EditorShellProvider 是 editor 项目的实际接入面，playground 作为仓内验证面
  必须演示消费它——否则该契约只在外部仓被踩到，违背「宿主 bump 前先在树内
  发现问题」的定位。authAdapter 缺省走 anonymous（createAnonymousAdapter），
  顺带演示 userResolver 匿名链路。
- 布局（纵向 flex）：InstanceShell（title「Custom Nodes」；actions：样例下拉、Save、status）→ 上 ~55% `SkinnedDecisionGraph`（`customNodes` + `simulateHandler={runSimulate}` 透传）→ 下 ~45% `TrustChainPanel`（内部滚动）。
- `ready` 前传空数组（节点晚一拍出现，可接受）。
- **决策（图 ID）**：udf-lab 用画布**实时图**喂 TrustChainPanel，本页闭环；Save 落 IndexedDB 但**不复用** `playground-graph`（避免与 graph 实例版本线互相覆盖）→ 新 GRAPH_ID `udf-lab-graph`。跨页延续仍走既有通路（graph 实例 Save → trust/reui 读）。
- 降级：schema 拉取失败显示「demo-server 不可达（:8787）」，仅基础节点可用，不 mock。

### UDF-5 目录卡片 + 构建登记 + README（~15 行）

- `directory-page.tsx` 加卡「🧩 Custom Nodes」；`vite.config.ts` input 加 `udf`；playground README MPA 表加一行；`playground.css` 加上下分栏样式 `.pg-split`。

## 2. 验证清单

1. `bun run build` 产出七个 HTML；trust/greet 等既有页不回归。
2. 浏览器逐项：udf.html 打开 → 面板出现 schema 驱动节点（4 个重名已被专用节点接管）→ 拖入编排 → simulator 全链路执行 → Trust 三步在实时图上跑通（audit 表出现 UDF 观察行，回放 CONSISTENT）。
3. **EditorShellProvider 契约验证**：schemaSource / simulate / persistence 三项 options 在仓内有真实消费（本页即 editor `decision-simple` 接入姿势的树内回归样板）。
4. 夹具 B 依赖 demo roster：先起 demo-server 再验。
5. 门禁：`pnpm run lint` + prettier + `tsc --noEmit` 错误集不新增。

## 3. 风险与未决

| 风险 | 处置 |
| --- | --- |
| 画布 UI 生成的 config 与手写夹具格式不一致 | UDF-3 执行时以画布导出为准对照修正 |
| 重名过滤后剩余 contrib（rate_window/ip_location/debugui/custom_list_query）参数体验参差 | 一期达标线 = 出面板、能执行；体验打磨留二期 |
| schema 端点暴露函数清单的安全顾虑 | demo-server 本就 demo-only 无鉴权；verdict 侧接入时按租户过滤属 U10 范畴 |

## 4. 执行顺序与规模

UDF-1（0.5h）→ UDF-2（0.5h）→ UDF-3（0.5h）→ UDF-4（1–2h）→ UDF-5（0.5h）→ 验证（0.5h）。合计约一个工作单元；各包可独立提交，UDF-2 可先行（纯重构）。

## 6. A1 浏览器验证记录（2026-09-27）

环境：demo-server（bun, :8787，demo_block 名单预置）+ playground vite dev（:5174，IPv6 localhost）。
逐项结果：

| 检查项 | 结果 |
| --- | --- |
| udf.html 打开、无降级横幅 | ✅ |
| Components 面板：schema 驱动节点出现（查询名单/HTTP 请求/摘要签名/当前日期/ab-bucket/custom-list-query/datetime + 4 内置 + legacy） | ✅ |
| 夹具 A 名单核验：载入 → 执行 → 决策结论 hit:true（1.2.3.4 命中 demo_block） | ✅ |
| Trust ① 审计：decisionId req-7ce76a601defc3 + inputHash + UDF 行（roster/query/2672µs/ok） | ✅ |
| Trust ② 回放 | ✅ CONSISTENT — 与历史结论一致 |
| 夹具 B 当前日期 | ✅ today=2026-09-27（current_date 首调 50138µs = TSFN/wasm 预热，二期打磨项） |
| 夹具 C 摘要计算 | ✅ digest = sha256("hello") 标准向量精确匹配（crypto 622µs） |
| RunMonitor tab | ✅ 渲染（▶ 运行（trace）+ 画布联动提示） |
| Save (IndexedDB) | ✅ saved v1（revision 语义正常） |
| 暗色切换 | ✅ 画布重皮 |

备注：③ 影子对比未走查（需候选模型 JSON 输入，功能在位）；夹具格式兼容性由
"手写夹具直接执行成功"实证。IAB 截图管线存在瓦片伪影，DOM innerText 为准。
