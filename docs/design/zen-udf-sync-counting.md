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

## 5. 对 zen-udf / verdict 的映射

| 结论 | 归属 | 形态 |
| --- | --- | --- |
| 算子语义三元声明（query/observe/act），HAProxy 算子 = observe | 本仓机制（Y1） | UdfPack `semantics` 字段 + 回放不重执行（Y3） |
| 观测值 journal（回放确定性） | 本仓机制（Y2/Y3） | DecisionAuditEvent.observed + `REPLAY_JOURNAL_MISS` fail closed |
| RateStore as-of / 事实层端口 | 本仓机制（Y4）+ verdict Redis 实现 | 事件时间窗口，存事实记录非递增计数器 |
| 热层实现（HAProxy stick table REST 端点） | xrule/verdict 侧 | `semantics: 'observe'` 的 UdfPack，实现调 REST |
| 原始事件保留期 / 幂等键去重 / 阈值偏置策略 | verdict 策略 | 数据保留、sink 幂等、阈值调优 |
| HAProxy 补强项 | xrule 侧 | 多副本按节点计数口径、租户键前缀、used 比例告警、基数自适应（HLL） |

## 6. 结论

HAProxy stick table 方案与 Cloudflare/Envoy/Kong 的在途限流同宗，是 **read-my-own-write 同步计数的正统业界实现**——处理时间与状态变更对 observe 算子是正确语义而非债务。设计上需要补的只有两条：基数自适应（HLL/CMS 兜底）与故障偏置显式化；配合 Y 系列的"观测值入审计 + 回放不重执行"，同步计数的速度优势与决策的确定性回放即可兼得。
