# zen-udf 开发计划 AA 系列（0.3.x：信任链产品化与发布安全）

状态：shipped · AA1–AA5 全部完成（2026-09-14，zen-udf 119/119；D15 按推荐落地：影子侧 act 一律不执行返回 intent 占位）
上游：U/V/W/X/Y 系列已 shipped；0.3.0 已发布 npm（语义三元/审计/回放/熔断/OTel/夹具全量能力）
定位：机制仓进入稳态后，本轮把 Y 系列的信任链**产品化**——让"发布安全（影子评估）""客户可验证（回放演示端点）""规模化（批量评估）"从能力变成可交付物。

## 现状盘点

- 审计事件（Y2）与 evaluateReplay（Y3）已就绪，但**回放只有库 API**——demo-server 无回放入口，客户可见形态缺失
- 模型发布无灰度路径：新 rev 直接切流量，无影子对比机制（Y 系列前的最佳实践清单明确"等 verdict 首个真实模型上线再做"——机制可先行）
- zen-engine 提供 `evaluateBatch`（批量评估），运行时尚无租户语义封装
- 输入错误在引擎执行中途才暴露（节点失败），缺执行前 fail-fast

## 总览

| 期 | 内容 | 依赖 | 状态 |
| --- | --- | --- | --- |
| AA1 | 影子评估（evaluateShadow + diff 报告） | — | ✅ 46bcd81e |
| AA2 | demo-server `/v1/replay` 端点（信任链可演示闭环） | — | ✅ 2256aabc / 3450109d |
| AA3 | 输入预校验（fail-fast） | — | ✅ assertJsonSafeInput（NaN/Infinity 守卫，实测 serde 崩溃场景） |
| AA4 | 批量评估封装（tenant batch） | Y4 | ✅ evaluateMany |
| AA5 | 性能基线基准（cache/limiter/audit 开销） | — | ✅ bench/perf.ts（缓存命中显著优于重建；数字见运行输出） |
| AA6 | verdict U10 联调支持 | — | 跨仓持续 |
| — | W4 上游 issue | 宿主 contextvars 总结 | 挂起 |
| — | Z6 OTel customNode 子 span | 上游修复 | 挂起 |

建议执行序：AA1 → AA2 → AA3 → AA4 → AA5；AA6 稳态。

## AA1 影子评估（shadow evaluation）

- `runtime.evaluateShadow(key, { prodRev, shadowRev }, input, options?)`：
  同一输入并行执行生产 rev 与影子 rev，返回 `{ prod, shadow, diff }`
- diff 报告：结论等价性（deepEqual）+ 字段级差异清单（`{ path, prod, shadow }`）+ 双侧耗时
- 语义纪律：shadow 侧 observe 照常执行（计数仍以生产侧为准的语义由宿主决定——文档说明）；act **在影子侧不执行**（返回 intent 占位，绝不双次拉黑）
- verdict 用途：新 rev 不一致率达标后切流；机制薄、价值高（发布安全的最后一块）
- 测试：一致输入/分歧输出、act 不双执行、双侧审计事件 source 标记

## AA2 demo-server `/v1/replay`（信任链可演示闭环）

- `POST /v1/replay`：`{ model, input, audit }` → 服务端按审计事件的 observed journal 构造回放（observe/act 读桩），返回重演结论 + 与 audit.output 的一致性标记
- 与既有 `/v1/execute trace=true` 串联成完整演示链：**执行（含审计）→ 回放（确定性核验）**——playground「Server run」之外第二张面向客户的牌
- demo-server 的 stateless 定位不变：audit 由调用方原样带回（demo 无存储）
- 测试：回放一致（observed journal 桩不重执行）、输入篡改被拒（inputHash 校验）、act 不双执行

## AA3 输入预校验（fail-fast）

- 按 inputNode 声明做浅校验（声明了输入字段的模型）：缺字段/类型不符 → 400 `INVALID_INPUT`（执行前拦截，不浪费整链路）
- 未声明字段的模型（现状多数）跳过校验——零破坏
- 测试：声明/未声明两态、违例字段清单

## AA4 批量评估封装

- `runtime.evaluateBatch(requests: [{ key, input, rev? }])`：统一租户上下文 + L1 缓存命中路径 + 逐条审计事件；结果包络对齐 zen-engine（success/error）
- 适用：verdict 批量评分/复核场景（单请求路径之外的吞吐补充）
- 测试：批量命中缓存、逐条错误隔离（单条失败不影响他条）、审计逐条下发

## AA5 性能基线基准

- `bench/`：L1 缓存 hit/miss、审计开启/关闭、limiter 开关、影子评估双跑的四组基准（Bun bench）
- 输出基线数字入文档——后续 zen-engine 升级/新特性以此对照（与 cache-semantics 哨兵互补：哨兵管语义，bench 管性能）
- 测试：不进常规套件（手动运行），脚本入 bench/ 并文档化

## AA6 verdict U10 联调支持

- 跨仓持续：按 [verdict-zen-udf-integration.md](./verdict-zen-udf-integration.md) 支持 U10；AA1/AA4 即为联调期高概率需求预留的机制

## 待宿主确认

- **D15**：影子评估中 act 的处理（推荐：**影子侧 act 一律不执行**，返回 intent 占位——绝不双次处置；生产侧照常。替代：由调用方显式传 allowShadowActions 开关）
