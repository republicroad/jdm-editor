# zen-udf 开发计划 DD 系列（信任链可视化）

状态：shipped · D19 裁决：不可达显式提示不 mock；D20 裁决：粘贴候选模型 JSON。DD1–DD3 完成（playground Trust Chain 页签，浏览器冒烟通过）
上游：U–CC 系列已 shipped；0.4.0 在架；demo-server 四端点齐（execute+audit / validate / replay / shadow）
定位：**信任链的最后一公里**——机制与端点已完备，本轮把它们变成客户看得见、点得动的产品界面。这是"实时决策引擎真正被客户信任"的最终演示形态。

## 现状盘点

- demo-server 四端点齐且 e2e 全绿（execute trace=true 带 audit、/v1/replay 一致性核验、/v1/shadow 字段级 diff、validate）
- playground 5 页签（graph/table/grid/reui）均不消费这些端点——信任链只有 API 形态，无产品演示面
- AA1 evaluateShadow / Y2 DecisionAuditEvent / Y3 replay 均为库与端点能力，无 UI 呈现

## 总览

| 期 | 内容 | 状态 |
| --- | --- | --- |
| DD1 | playground 第六页签 "Trust Chain"（执行→审计→回放三步工作流） | ✅ |
| DD2 | 影子对比面板（双模型 diff 表 + 等价性标记） | ✅ |
| DD3 | 连接态与降级（demo-server 不可达时的显式提示） | ✅ |
| 稳态 | verdict U10 支持 / W4 / Z6 | 跨仓/挂起 |

建议执行序：DD1 → DD2 → DD3（单页签内递进实现）。

## DD1 Trust Chain 页签：执行→审计→回放

- playground 新增第六页签，三步工作流（单页纵向流）：
  1. **执行**：以 Graph 页当前模型调 `POST /v1/execute trace=true` → 渲染决策结论 + 审计事件卡片
     （inputHash 截断、observed UDF 调用表：name/semantics/micros/code、processingTime）
  2. **回放**：一键 `POST /v1/replay { model, input, audit }` → 一致性标记（绿 CONSISTENT / 红 DIVERGED）
  3. **证据**：审计事件 JSON 折叠视图（可复制——交给 verdict/客户的凭证形态）
- 组件：`src/trust-chain-page.tsx`；App.tsx nav 增页签；stateless（不落存储）
- 依赖：demo-server :8787 运行（CC1 后已有 /v1/replay；execute 已带 audit）

## DD2 影子对比面板

- 同页签下半区：左侧当前模型（Graph 页导出），右侧粘贴候选模型 JSON →
  `POST /v1/shadow { prodModel, shadowModel, input }` → 渲染等价性标记 + 字段级 diff 表（path/prod/shadow）
- 语义提示行：act 类算子影子侧为 intent 占位（AA1 机制，说明文案引用 Y 系列）
- 测试：diff 表渲染、等价/分歧两态

## DD3 连接态与降级

- demo-server 不可达：页签顶部显式提示（地址 + 启动命令 `pnpm demo-server`），不 mock 数据
- fetch 超时/错误统一错误条

## 验收

- e2e：探针已覆盖四端点 API 链路（BB1 扩展）；UI 层以 `pnpm playground` + 手动冒烟验收（页签渲染、三步流、两态标记）
- 根门禁：lint/typecheck/kernel+appshell tests

## 稳态（不新增系列）

- verdict U10：跨仓持续（按 verdict-zen-udf-integration.md + CC3 命名约定表对接）
- W4 上游 issue：挂起（等宿主 contextvars 总结；跨运行时总结文档已就绪）
- Z6 子 span：挂起（等上游修复，收益自动到 Y6 桥）
