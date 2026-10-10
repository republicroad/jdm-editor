# 语义感知缓存（Semantics-Aware Memoization）——1.0 后首项规划设计

- 日期：2026-10-04
- 状态：**已否决（2026-10-10 宿主裁决）——框架级缓存不做，缓存职责移交函数实现；本文保留为决策记录**
- 裁决原文：缓存逻辑交给实际的自定义函数去实现；zen-udf 作为框架保证每次
  自定义节点函数执行都执行对应的函数（每次调用=真实执行，框架永不跳过）
- 上位：语义三元设计结论（query 管验证、observe 管时间、act 管危险——第三处
  硬机制消费点）；业界先例 = Temporal activity 结果记忆化 / Step Functions
  结果缓存 / Shopify Functions CPU 预算同族
- 现状依赖：0.15 实例依赖调度（`$.key` 引用链 DAG 化，`depsByItem` 可复算）、
  auditJournalRegistry（免 trace 化轨迹源）、UdfSemantics 注册期三分

## 0 · 裁决记录（2026-10-10）

**否决框架级 memoization，理由与后果：**

1. **框架契约更简单**：「每次调用=真实执行」是无例外的执行模型——引擎行为
   对作者、审计、回放三方都零特例（MEMOIZED trace、memoize 开关、
   replay 绕过 memo 等特例面全部不再需要）；
2. **职责归位**：是否可缓存、缓存粒度/时窗/容量是**函数作者的业务判断**
   （与 observe 时窗桶「引擎不代拍」同一逻辑推到极处）——函数实现内部
   自行 memoize（闭包 Map/外部缓存客户端）即可，框架无需也不应代管；
3. **零代码改动**：zen-udf 现行 `executeExpr` 本就无缓存层——裁决即现状
   立法，1.4.0 memoization 批次取消，无发版动作；
4. **语义三元不受影响**：注册期 query/observe/act 三分继续服务
   影子评估/回放/审计三面（本设计原拟的「第三处硬机制消费点」不再落地——
   语义分类的消费点维持两处）；
5. **函数侧自缓存的注意义务**（随裁决移交作者）：query 类函数内部缓存
   自行保证租户隔离与 pack 版本失配；observe/act 类函数自缓存即语义
   自决——act 的处置效果与 observe 的时间性由作者自行担保，注册期
   语义声明仍是治理面的真话来源。

下方原设计稿（§1-§9）保留为历史记录，不再实施。

## 1 · 问题

决策级 L1 缓存（DecisionCache）只覆盖「整图 × 输入」粒度；函数调用粒度
（executeExpr → registry.call）每次求值都真实执行 UDF——同一决策内和跨请求间
的重复调用（同函数同实参）在高频热路径上全部真实执行。业界同位均有函数级
记忆化，但**盲memoize 对 observe/act 是错的**（时间性/副作用被缓存即语义破坏）
——必须按语义三元分档，这正是语义三元作为「第三处硬机制消费点」的落地。

## 2 · 设计（三档语义分档）

| 语义 | 缓存策略 | 键 | 依据 |
| --- | --- | --- | --- |
| **query** | 内容寻址记忆化，默认开 | `h(packNamespace.name, argsHash, schemaVersion)` | 纯函数：同输入恒同输出 |
| **observe** | 时窗缓存（TTL 桶），**默认关**（opt-in） | 上述键 + `floor(t / ttlBucket)` 时间桶 | 结果随时钟/外部状态变——只在桶内视作同值；不同桶=不同键 |
| **act** | **永不缓存** | —（直接穿透） | 处置效果：缓存=漏执行，与影子「绝不双次处置」同哲学 |

- **argsHash**：对绑定后 kwargs 做稳定序列化（键排序）后 sha256——与审计
  inputHash 同款手法；
- **packVersion 进键**：函数升级（同 name 不同 pack 版本）自动失配——不依赖
  主动失效（与缓存「永不改写历史」的 Event Sourcing 哲学一致）；
- **作用域**：进程内 LRU（容量可配，缺省 1024 条/函数），**不跨进程**（Redis 化
  属宿主端口演化，不在首期）；
- **降级即关**：`memoization: false`（或运行时开关）一键全关——缓存是纯优化，
  任何可疑行为先关再查（与审计免 trace 化的可关闭性同款）。

## 3 · 实施位置（engine 侧，registry 之外）

```
executeExpr（engine.ts）
  └─ 熔断/并发闸 之后、registry.call 之前：
     if (semantics === 'query' && memoizeOn) → 读 memo 缓存，命中即返回（trace 标 memoized）
     未命中 → 执行 → query 结果写缓存
```

- **拦截点选 executeExpr 而非 registry.call**：前者已持有 semantics/trace 上下文，
  且 `registry.call` 保持纯查找语义（直调方不受缓存影响——缓存是执行路径优化
  而非数据面行为）；
- **trace 透传**：命中条目 `micros=0, code='MEMOIZED'`（新错误码家族外的
  观测标记，进 CONTRACT §11.7 或 §5 附注）——RunMonitor/Trust Chain 可见；
- **与 Y3 回放互斥**：replay 上下文下 memo 缓存**绕过**（query 类走 asOf 重执行
  是回放的确定性证明本体，命中缓存会使回放退化）——顺序：replay 判定先于
  memo 判定。

## 4 · observe 时窗桶（opt-in，二期）

`{mode: 'observe', ttlMs}` 由宿主按函数声明（注册期 `cache: {observeTtlMs}`）：
时间桶 = `floor(asOf ?? now / ttlMs)`——同桶视为同值。**默认关**的理由：
current_date 等函数的「同值窗口」是业务判断（分钟桶？秒桶？），引擎不代拍。
二期随真实需求落地（首期 observe 直通不缓存）。

## 5 · act 绝不缓存的实现防线

- 语义分档硬编码 `act` 不进 memo 路径（与影子同款结构性防御，非配置可开）；
- 测试锚：act 调用计数在重复同参调用下恒递增（防「配置失误打开 act 缓存」回归）。

## 6 · 验收清单

1. query 同参二调命中（第二调 micros=0 + MEMOIZED 标记 + 调用计数=1）；
2. packVersion 变化 → 键失配 → 重执行；
3. observe 默认直通（无缓存）；opt-in TTL 桶内命中/跨桶未命中；
4. act 重复同参调用计数恒递增（结构性不缓存）；
5. replay 上下文绕过 memo（回放确定性不退化）；
6. memoization=false 一键全关（零行为变化回归）；
7. 多租户：cacheKey 含 tenantId 租户隔离（上下文相关 UDF 防串号）。

## 7 · 实施切分

| 步 | 内容 | 量级 |
| --- | --- | --- |
| 1 | MemoCache（LRU+TTL 桶通用件，decision-cache.ts 同族）+ 拦截点接入 executeExpr + MEMOIZED trace | ~0.5 天 |
| 2 | 租户隔离键 + replay 绕过 + 开关 + 测试 1-7 | ~0.5 天 |
| 合计 | zen-udf **1.2.0**（minor：纯机制 additive，无契约变更） | ~1 天 |

## 8 · 后果

- 正面：高频热路径同参 UDF 调用 O(1) 化；语义三元获得第三处硬机制消费点
  （注册期分类 → 回放/影子/缓存三面复用）；MEMOIZED 观测可见；
- 约束：进程内 LRU 容量（不跨进程）；observe opt-in 的 TTL 是业务判断；
  缓存与断路器顺序（memo 命中不计熔断——命中=未执行，熔断计数应穿透）；
- 依赖：无新依赖；decision-cache 同族通用件复用。
