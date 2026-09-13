# zen-udf 同步硬实时计数：read-my-own-write 调研与业界实践

状态：design · 调研结论文档（ha_proxy stick table 方案的正统性论证 + 端口分层依据）
关联：[zen-udf-plan-y.md](./zen-udf-plan-y.md)（observe 语义声明 / 审计 journal / replay）· [zen-udf-multi-tenant.md](./zen-udf-multi-tenant.md)

## 1. 问题定义：一致性档位

实时风控决策对"频次/去重计数"的一致性要求分三档：

| 档位 | 语义 | 决策可见性 | 代表实现 | 适用场景 |
| --- | --- | --- | --- | --- |
| **read-my-own-write（在途）** | **当前事件的计入与读出在同一原子操作内完成**，决策基于含自身的新计数 | 立即 | HAProxy stick table、OpenResty shdict、Envoy local rate limit | 速度类/设备类实时拦截（当前事件改变决策结论） |
| read-after-write（跨调用） | 同 key 后续事件可见前值 | 下一次调用 | Redis Lua 原子窗口（单脚本 INCR+EXPIRE+读） | 准实时关联分析 |
| eventual（异步） | 特征滞后数秒~分钟 | 延迟对齐 | Flink/Kafka 特征作业 | 历史聚合类特征（不含当前事件也成立的特征） |

**关键判断**：Flink/Kafka 体系的计数是异步特征（ eventual 档），其 queryable state 亦不保证含最新事件（官方文档明示异步对齐）——**不满足在途决策的 read-my-own-write 要求**。同步硬实时计数需要独立的一套实践。

## 2. 业界实践全景

### 2.1 数据平面内嵌计数（first-touch increment，零额外跳）

最早看到事件的组件在代理/网关路径内原子完成 RMW：

| 实现 | 机制 | 同机量级 |
| --- | --- | --- |
| **HAProxy stick table**（本仓 xrule 方案） | 代理路径内 `sc-inc-gpc0` + `table_gpc0_rate` 原子观测+滑窗读，单 GET 完成 | µs 级，单点 10⁵+ QPS |
| OpenResty/Kong/APISIX | `shdict:incr` 共享内存字典原子 INCR+TTL（Kong rate-limiting 插件 local 档） | µs 级 |
| Envoy local rate limit | 进程内令牌桶（另有 global rate limit service 外呼档做跨节点协调） | µs 级 |
| Cloudflare 边缘限流 | PoP 内存近似滑窗计数器（跨 PoP 采样传播，不做强一致聚合） | 边缘规模 |

### 2.2 Key 分片单写者状态（一致性靠路由，不靠协调）

入口按实体 key 一致性哈希，同一 key 恒定落同一分片/节点 → 分片内单写者内存 RMW 天然原子，无分布式协调。多节点计数为**每分片精确**而非全局聚合。Kafka 分区、Redis cluster slot、Hazelcast partition-aware 均为此模式。**业界共识：不做跨节点聚合**——聚合即放弃内存计数的数量级优势（等价于 Redis 化）。

### 2.3 服务端原子 RMW（一次往返，全局一致档）

| 实现 | 机制 | 同 DC 延迟 |
| --- | --- | --- |
| Redis + Lua | INCR+EXPIRE+ZADD+ZRANGEBYSCORE 封单脚本，原子且一次往返；cluster 用 hash-tag 定槽 | ~200–500µs |
| Hazelcast / Geode | Entry Processor 服务端原子读改写 | ~100–500µs |
| Aerospike / Tarantool | 内存命名空间 + bin 原子操作 / Lua；广告竞价与实时决策大量使用 | ~500µs–1ms |

### 2.4 基数爆炸的近似结构（自适应表示）

exact 逐成员键（基数=存储，如 `group:v` 组合键）在攻击风暴下会击穿内存上限。业界按基数自适应：

- **HLL（滑窗变体）**：固定内存、~1–2% 误差——去重计数超阈值后切换
- **Count-Min Sketch / Top-K（Space-Saving）**：heavy hitter 内联检测
- HAProxy `gpc0_rate` 本身即采样近似滑窗——近似性是这类实现的常态而非例外

## 3. 最佳实践综述（七条）

1. **按延迟预算分层特征**：仅"当前事件会改变决策结论"的特征（速度/设备跳变）进同步在途层；历史聚合进异步 Flink 层；离线画像进 batch 层（Feast online/stream/batch 三层形态）。不是所有特征都配同步。
2. **同步层嵌进数据平面或与决策同宿**：首触组件原子完成 RMW，零额外网络跳。
3. **单写者靠路由**：key 一致性哈希分片；每分片精确，禁止跨分片聚合。
4. **一次往返原子 RMW**：计数+读窗+TTL 续期同一操作内完成（stick table 原生；Redis 必须 Lua 合并，禁止 INCR 与读分离两跳——同 key 并发事件会丢计数）。
5. **基数自适应**：exact 逐成员 → HLL/CMS，按表 used 比例切换并告警。
6. **故障偏置有意化 + 近似性文档化**：重启丢表 = 计数归零 = fail-open（漏判方向）；上游重试 = 重复计数 = fail-closed（多判方向）——风控场景刻意让偏置不对称（宁多判），且重试以幂等键去重；近似滑窗（采样估计）写入算子契约。
7. **观测值入审计**：同步计数属 observe 类——返回值被决策审计事件 journal 钉住，回放确定性不依赖热表（见 Y 系列模式）。

## 4. 分层架构：热层与事实层

```
决策时：  counter = 热层 observe(key)        ← 处理时间、近似、原子、极快（HAProxy）
          decision = f(model rev, input, counter)
审计时：  事件记录 { inputHash, observedCount: counter, modelRev, output }   ← Y2 审计事件
回放时：  decision' = f(modelRev, input, journaledCounter)   ← 不触热层，确定性重演（Y3）
复盘时：  事实层按事件时间重算窗口   ← (tenant, key, eventTime) 原始事件流（RateStore as-of / 离线，Y4）
```

- **热层**（HAProxy stick table）：处理时间、近似、read-my-own-write——服务"此刻的决策"
- **事实层**（RateStore as-of / 事件流）：事件时间、精确——服务审计、回放、复盘、模型训练（point-in-time join，Feast online/offline store 同型分层）
- 两层**不需要一致**：热层是"此刻的近似观测"，事实层是"完整历史真相"；回放永不依赖热层（观测值已 journal），取证与训练不依赖热层（原始事件在事实层）

- **热层**（HAProxy stick table）：处理时间、近似、read-my-own-write——服务"此刻的决策"
- **事实层**（RateStore as-of / 事件流）：事件时间、精确——服务审计、回放、复盘、模型训练（point-in-time join，Feast online/offline store 同型分层）
- 两层**不需要一致**：热层是"此刻的近似观测"，事实层是"完整历史真相"；回放永不依赖热层（观测值已 journal），取证与训练不依赖热层（原始事件在事实层）

### 4.1 全局一致同步层（中间层）选型：Aerospike vs Tarantool

当 stick table 的"每节点计数"口径成为业务瓶颈（请求跨节点打散、需要跨节点全局一致的速度/状态，延迟预算仍 >1ms），业界路径是引入**全局一致同步层**——Aerospike 与 Tarantool 是两个正统选项。两者同为"key 分片单写者 + 内存优先 + 服务端计算"，差异如下：

| 维度 | **Aerospike** | **Tarantool** |
| --- | --- | --- |
| 出身/定位 | 2009（Citrusleaf），为 RTB 广告科技而生：画像库/频次上限/预算 pacing | Mail.ru Group（VK）研发：Lua 应用服务器 + 内存 DBMS 合体 |
| 容量模型 | 索引全内存 + 数据落 NVMe/SSD——TB 级用户库只付索引的内存钱 | memtx 全内存 + vinyl 磁盘 B-tree（容量受 RAM 约束，vinyl 慢一档） |
| 线程模型 | 每分区单线程原子操作（无锁、p99 可预测） | 每分片单线程 fiber 事件循环（同 Redis 式原子性） |
| 数据模型 | 记录（bin）+ 二级索引 + **记录级 TTL 原生**（对齐 campaign 投放期） | space/tuple + tree/hash 索引（更灵活）；TTL 需 expire 模块/懒删除 |
| 事务 | 单记录强一致（SC 模式）；v7.0+ 多记录 ACID 事务 | **完整 ACID 事务**（memtx）——数据库语义更全 |
| 服务端计算 | Lua UDF（服务端原子多 bin 逻辑） | **Lua 应用服务器**：整段业务逻辑 + HTTP/队列都在数据侧——"决策逻辑下推"的最彻底形态 |
| 复制/跨 DC | XDR（成熟，多机房实时复制为卖点） | 同步复制（quorum synchro）+ Cartridge/TDG 集群框架 |
| 验证规模 | RTB 万亿级：Criteo 9500 亿匹配/天（~50ms 响应）、Nativo 1.4 万亿请求/月（10 年零宕机）、The Trade Desk | Alfa-Bank 投行核心（IB-Core，40+ 节点 TDG）；Tarantool DB 银行余额/流水操作型存储（≥20K TPS）；Ozon Fintech 同生态大用户 |
| 生态/语言 | 客户端全（Java/Go/Python/C#/Node/REST），全球企业客户 | Lua 生态（逻辑与数据同语言），社区偏俄语圈（HighLoad++） |
| 许可 | 社区版 **AGPLv3**（自托管内部服务可用，注意网络服务条款）+ 商业双许可 | **BSD-2-Clause**（宽松）+ TDG 商业版 |

场景选型：

- **全局速度/去重计数层**（stick table 语义的全局化升级）→ **Aerospike 更贴近**：bin 原子自增 + 记录 TTL + 强一致，RTB 十年万亿级验证的就是这一负载；SSD 分层让长 TTL（按天/周频次）不贵
- **整段决策逻辑下推到数据侧**（读账户+计数器+规则分支+更新状态一次往返，对应 xrule 的 Lua 方向）→ **Tarantool 更强**：Lua 应用服务器即"逻辑住在数据旁边"的原生形态，Alfa-Bank 投行核心为同型验证
- 二者都是 **observe/query 端口的后端替换**（换实现不换契约）；引入时机纪律：**仅当每节点口径真成瓶颈**（延迟预算 >1ms 且需跨节点一致）才引入，否则 stick table 热层已足

### 4.2 事实层选型：FoundationDB

**定位辨析**：FoundationDB（FDB）与 §4.1 的 Aerospike/Tarantool **不构成竞争关系**——FDB 是"严格串行化事务 KV"（Apple 2015 收购、2019 开源，Apache 2.0），架构核心是确定性仿真测试带来的极端正确性 + 计算存储分离。它的写事务延迟地板（GRV 读版本 + 提交等待，典型 ~5–15ms）决定了它**不能进在途计数层**；但它恰是事实层（L0 模型库 / 审计存档 / 元数据）的强一致底座候选。

关键特征与错位论证：

| 维度 | FDB 表现 | 对在途计数层的含义 |
| --- | --- | --- |
| 事务 | 全键空间**严格可串行化** ACID，MVCC + 乐观并发（冲突重试） | 强一致注册/存档无忧 |
| 延迟 | 写事务 ~5–15ms（GRV + 提交等待版本稳定），读个位数 ms | 比 stick table/Aerospike 慢 1–2 个数量级——**禁止进热层** |
| 原子自增读 | atomic op（`ADD`）无冲突但不回读；事务内 read-my-own-write 需 get+add（付冲突与延迟代价） | 不满足同步计数核心语义 |
| TTL | 无原生记录 TTL（自建清理层） | 滑窗过期需另行实现 |
| 排序 | **versionstamp**：每次提交获得全局有序版本号 | 天然适配模型 rev 不可变链（L0） |
| 许可 | Apache 2.0（宽松，无 AGPL 顾虑） | verdict 自托管无忧 |

事实层用途映射：

1. **L0 模型内容库**：`(tenant, key, rev)` 不可变版本链——FDB tuple + versionstamp 天然给出 rev 的全局排序（发布顺序即版本序），严格串行化保证登记无竞态
2. **审计事件存档**（Y2 DecisionAuditEvent 的持久化层之一）：事务性追加不丢事件，海量有序
3. **元数据/注册中心**：先例——**Snowflake 的元数据层构建在 FDB 上**（SIGMOD 论文公开）；Apple 自家 iCloud 日历/通讯录等数 PB 级验证

运维现实：FDB **无官方托管服务**，集群运维/备份/DR/客户端调优需要专家技能，社区小而精（Apple/Snowflake 级团队如鱼得水）。verdict 初期规模下 L0 用 **PostgreSQL 起步**，把 FDB 记入观察名单——当审计存档与模型注册的一致性/规模需求真实超出 PG 时再迁移。

## 6. 对 zen-udf / verdict 的映射

| 结论 | 归属 | 形态 |
| --- | --- | --- |
| 算子语义三元声明（query/observe/act），HAProxy 算子 = observe | 本仓机制（Y1） | UdfPack `semantics` 字段 + 回放不重执行（Y3） |
| 观测值 journal（回放确定性） | 本仓机制（Y2/Y3） | DecisionAuditEvent.observed + `REPLAY_JOURNAL_MISS` fail closed |
| RateStore as-of / 事实层端口 | 本仓机制（Y4）+ verdict Redis 实现 | 事件时间窗口，存事实记录非递增计数器 |
| 热层实现（HAProxy stick table REST 端点） | xrule/verdict 侧 | `semantics: 'observe'` 的 UdfPack，实现调 REST |
| 全局一致同步层（跨节点频次/状态，引入时） | verdict 侧 | Aerospike（计数/频次/TTL）或 Tarantool（决策逻辑下推），observe/query 端口后端替换 |
| 事实/元数据层强一致底座（规模超出 PG 时） | verdict 侧 | FoundationDB（versionstamp=rev 排序；L0 模型库 + 审计存档），Apache 2.0 |
| 原始事件保留期 / 幂等键去重 / 阈值偏置策略 | verdict 策略 | 数据保留、sink 幂等、阈值调优 |
| HAProxy 补强项 | xrule 侧 | 多副本按节点计数口径、租户键前缀、used 比例告警、基数自适应（HLL） |

## 7. 结论

HAProxy stick table 方案与 Cloudflare/Envoy/Kong 的在途限流同宗，是 **read-my-own-write 同步计数的正统业界实现**——处理时间与状态变更对 observe 算子是正确语义而非债务。设计上需要补的只有两条：基数自适应（HLL/CMS 兜底）与故障偏置显式化；配合 Y 系列的"观测值入审计 + 回放不重执行"，同步计数的速度优势与决策的确定性回放即可兼得。跨节点一致成为真实瓶颈时，按 §4.1 选型引入 Aerospike/Tarantool 全局同步层——observe/query 端口后端替换，决策图与审计/回放语义零改动。事实/元数据层（L0 模型库与审计存档）的强一致底座候选为 FoundationDB（§4.2），初期 PostgreSQL 起步、FDB 留作规模触顶后的迁移目标。

## 参考来源

- [Criteo customer story（9500 亿匹配/天）](https://aerospike.com/resources/customer-stories/criteo-real-time-ad-bidding/)
- [Nativo customer story（1.4 万亿请求/月）](https://aerospike.com/resources/customer-stories/nativo/)
- [The Trade Desk customer story](https://aerospike.com/resources/customer-stories/trade-desk/)
- [Building a Fast User Profile Store for RTB](https://aerospike.com/blog/user-profile-store-rtb/)
- [Tarantool for Banks](https://www.tarantool.io/en/banks/) · [Alfa-Bank case（IB-Core 40+ 节点）](https://www.tarantool.io/en/cases/alfabank/) · [Tarantool DB 银行用例（≥20K TPS）](https://www.tarantool.io/en/tarantooldb/)
- [Redis vs Tarantool（VK/Habr）](https://habr.com/en/companies/vk/articles/575772/)
- [Aerospike Community 许可（AGPLv3）](https://github.com/aerospike/aerospike-server/blob/master/LICENSE)
- [FoundationDB（Apple 开源公告）](https://www.foundationdb.org/blog/announcing-foundationdb-documentation/) · [FDB 文档](https://apple.github.io/foundationdb/) · [Snowflake Using FoundationDB（SIGMOD 论文）](https://www.mdpi.com/journal/data) — Snowflake 元数据层先例见 [Snowflake 工程博客](https://www.snowflake.com/blog/inside-snowflake-metadata-teams-journey-to-foundationdb/)
