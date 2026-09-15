# zen-udf 开发计划 V 系列（发布与收尾）

状态：shipped · V1–V8 全部完成（2026-09-13，zen-udf 98/98 + demo-server 9/9；0.2.0 发布就绪，实际 publish 由宿主/CI 执行）
宿主裁决 D4–D6 见文末。
上游：U 系列（U2–U9）已 shipped，见 [zen-udf-development-plan.md](./zen-udf-development-plan.md)
定位：U 系列完成了机制与租户契约；V 系列完成**对外发布、规范收尾、消费方验证、上游回馈**。

## 总览

| 期 | 内容 | 依赖 | 状态 |
| --- | --- | --- | --- |
| V1 | 0.2.0 发布准备（README/exports 审计/npm 冒烟） | — | ✅ 23270401 |
| V2 | 返回值契约（§6.5 returnsSchema 校验） | — | ✅ 4c29ef29 |
| V3 | UDF 级 trace（§6.6 耗时/错误码入 traceData） | V2 | ✅ 4c29ef29 |
| V4 | 表达式错误脱敏（§6.7） | — | ✅ 4c29ef29 |
| V5 | 上下文加固（冻结副本 + 混合租户并发断言） | — | ✅ 94d06e23 |
| V6 | 上游回馈：gorules/zen 原生传播 issue + 复现 + PR 草案 | — | ✅ 草稿 docs/rfc/gorules-zen-async-context.md |
| V7 | demo-server 升级消费 zen-udf（真实消费方验证） | V1 | ✅ 208403d9 |
| V8 | verdict U10 交接包（集成指南 + 端口实现规范） | V1 V2 V3 | ✅ verdict-zen-udf-integration.md |

建议执行序：V1 → V2 → V3 → V4 → V5 → V6（可并行）→ V7 → V8。

## V1 0.2.0 发布准备（宿主裁决 D2 落地）

- `packages/zen-udf/README.md`：定位（zen-engine customNode UDF 运行时）、快速上手（DecisionRuntime + UdfPack + createUdfRegistry）、端口清单（RateStore/ConcurrencyLimiter/EgressGuard/SecretResolver）、租户语义与 conformance 指引
- exports 审计：index.ts 公开面冻结检查；未公开但应公开的类型补齐（如 `UdfToolDef` 若与 ContribToolDef 分离）
- `private: true` → 移除；version 0.2.0；npm provenance/`files` 白名单核对（不发 graph/ 与测试）
- 根仓 `test:npm-smoke` 接入 zen-udf 冒烟（npm 安装 → DecisionRuntime 跑通一张含 customNode 的图）
- 验收：`npm publish --dry-run` 通过 + 冒烟绿

## V2 返回值契约（设计稿 §6.5）

- UdfRegistry 增 `validateResult(name, result): string[]`：按 `returnsSchema` 断言（type/required/properties 顶层语义）
- DecisionRuntimeOptions 增 `resultValidation?: 'off' | 'warn' | 'enforce'`（缺省 `warn`，待宿主确认 D5）：
  - `warn` → 违例计入 trace、结果原样返回
  - `enforce` → 违例返回 `{ error: { code: 'INVALID_RESULT', issues } }`
- 测试：违例类型、必填缺失、off/warn/enforce 三态

## V3 UDF 级 trace（设计稿 §6.6）

- executeExpr 埋点：耗时（µs）、错误码（INVALID_PARAM/UDF_TIMEOUT/UDF_ERROR）、resultValidation 违例 → 写入 customHandler 返回的 `traceData`
- zen-engine trace 已含 node 级 input/output；本项补 UDF 函数粒度（simulator 时间线与 verdict 审计共用）
- 测试：正常/超时/参数违例三种 trace 形状断言

## V4 表达式错误脱敏（设计稿 §6.7）

- `evaluateExpressionSafe` 的异常信息出 trace 前过脱敏：内部路径、env 值模式替换为占位
- 提供可注入脱敏器（verdict 可替换更强策略）；缺省内置规则
- 测试：含路径/环境值样式的错误被替换

## V5 上下文加固（传播文档 §5 加固项）

- 嵌入输入的 ExecContext 以 `Object.freeze` 冻结副本（防模型侧篡改共享对象）
- 新增混合租户并发断言：两租户并发 evaluate 同一 runtime，各 UDF 看到各自 tenantId（对"embed 随请求走"语义的最强验证）
- 测试即交付

## V6 上游回馈：gorules/zen 原生传播（传播文档 §3/§4）

- 向 gorules/zen 提 issue：ALS 丢失探针 + 复现说明 + 影响面（OTel/ALS 生态不可用）
- PR 草案：bindings/nodejs 在 evaluate 同步入口 `napi_async_init` 捕获 context、customHandler TSFN 派发改 `napi_make_callback`（变体 A，零 API 变更）
- 验收：上游 CI 通过；本仓测试全绿（保留键通道与之共存）
- 与 V1–V5 并行推进，不阻塞

## V7 demo-server 升级消费 zen-udf

- 现状：demo-server 直连 zen-engine 0.54（Bun），与 zen-udf 的 2.0.2 双轨
- 升级：demo-server 改用 `DecisionRuntime`（UdfPack 形态挂 http/roster 参考域），下线 0.54 直连代码路径
- 价值：真实消费方验证发布物；playground「Server run」链路全栈统一到 2.0.2
- 验收：playground graph 页签 Server run 冒烟绿；demo-server 测试绿

## V8 verdict U10 交接包

- `docs/design/verdict-zen-udf-integration.md`：verdict 侧接入指南——
  - 端口实现清单与验收标准（RedisRateStore/ConcurrencyLimiter/EgressGuard/SecretResolver + conformance 套件用法）
  - model-execute 组装规范（DecisionRuntime + UdfPack + L1 缓存键 `${tenantId}:${key}@${rev}` + metricsSink→Prometheus）
  - UdfPack 编写规范（注册是 deploy-time、租户走 ExecContext、secret 走端口）
- 交付物给 verdict 仓（独立 agent 执行 U10）

## 宿主裁决（2026-09-13 已确认）

- **D4** ✅：demo-server 升级消费 zen-udf **纳入本仓**，源码直通
- **D5** ✅：`resultValidation` 缺省 **`warn`**（不破坏现有图），以后择机切 `enforce`
- **D6** ✅：**V5 完成后再发 0.2.0**（V1 的 README/冒烟先行，版本收口在 V5 后）
