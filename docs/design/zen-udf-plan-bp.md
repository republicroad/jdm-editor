# zen-udf 文档最佳实践目录规划

> 目标：把 U–CC 十轮系列中产生的**可复用模式**从设计文档中提取出来，
> 收录到 `docs/bestpractice/` 作为独立的最佳实践指南。
> 与 ADR（选型归档）和 Design Doc（排期计划）互补——BP 是**面向未来的操作指南**。

## 现状

`docs/bestpractice/` 已有两篇高质量 BP（monorepo-app-and-libraries、reui-component-pattern），
模式成熟：**适用场景 → 核心模型 → 对比表 → 铁律 → 仓内实例交叉引用**。

zen-udf 十轮系列产生了大量可复用模式，但散落在设计文档与计划文档中，
新团队成员或跨仓消费者需要通读全部历史才能提取。

## 规划目录结构

```
docs/bestpractice/
├── README.md                              ← 索引（BP 清单 + 选用规则）
├── monorepo-app-and-libraries.md          ← 已有
├── reui-component-pattern.md              ← 已有
├── cross-boundary-context-propagation.md  ← BP-01 新建
├── sentinel-test-pattern.md               ← BP-02 新建
├── conformance-test-suite.md              ← BP-03 新建
├── semantic-triad-effect-isolation.md     ← BP-04 新建
├── cache-ownership-pattern.md             ← BP-05 新建
└── docs-taxonomy.md                       ← 已有（documentation-taxonomy.md 的引用）
```

## BP 清单

### BP-01 跨边界上下文传播

- **模式**：隐式上下文（ALS / contextvars）不跨原生边界（TSFN / WASM / IPC / RPC）——
  在每个边界做「捕获 → 序列化 → 交接 → 重建立」
- **来源**：Y 系列探针 + context-propagation 文档
- **跨运行时对照**：Node ALS（全丢）/ Python contextvars（同步可见、异步构造期捕获）/ Go ctx（显式传递）
- **通用化**：任何"宿主 → 原生/外部回调"链路都适用

### BP-02 哨兵测试模式

- **模式**：把第三方依赖的关键行为（缓存语义/错误形状/API 签名）钉进测试——
  依赖升级若改变行为，测试先红
- **来源**：`engine-cache-semantics.test.ts`（zen-engine 缓存语义）
- **适用**：任何「我们依赖了它当前的行为但未在文档中承诺」的外部依赖

### BP-03 契约测试套件

- **模式**：端口接口 + 参考实现 + conformance 测试——
  端口的任何替代实现（Redis / 内存 / mock）必须通过同一套测试
- **来源**：`rateStoreConformance`（BB5）
- **适用**：所有策略端口（RateStore / ConcurrencyLimiter / EgressGuard / SecretResolver）

### BP-04 语义三元：效果隔离

- **模式**：UDF/插件按副作用分类（query / observe / act），运行时按声明强制回放与幂等行为
- **来源**：Y 系列语义三元 + AA1 影子评估 act 占位
- **适用**：任何有副作用的插件/回调系统

### BP-05 缓存所有权模式

- **模式**：引擎无缓存时宿主必须自管——LRU + 空闲 TTL + 不可变版本键 + 哨兵测试钉死引擎语义
- **来源**：U4 探针实证 + AA3 DecisionCache
- **适用**：任何"引擎/框架不缓存，责任在调用方"的场景

### BP-06 ESM-only 源码发布

- **模式**：TS 源码直发（main = src/index.ts），不编译 dist——消费方需 bundler/tsx/Bun
- **来源**：zen-udf 0.2.0–0.4.0 发布实践
- **适用**：内部工具包、消费方全为可控环境的场景

## 不收录的（及原因）

| 内容 | 原因 |
| --- | --- |
| ADR（选型归档） | 已有 `docs/adr/` 独立目录 |
| 设计文档（架构分层/约束） | 已有 `docs/design/` 独立目录 |
| 排期/门禁/决策点 | 属于开发计划，非可复用模式 |
| troubleshooting（已知缺陷与修复） | 已有 `docs/troubleshooting.md` 独立文件 |

## 每篇 BP 的格式（沿用已有模式）

1. **标题**：模式名（一句话说清做了什么）
2. **适用场景**：什么条件下该用
3. **核心模型**：对比表或分层图
4. **铁律/要点**：不可违反的规则
5. **仓内实例**：交叉引用到具体代码/测试/设计文档
6. **反模式**：常见错误做法及后果
