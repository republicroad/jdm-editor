# zen-udf Tool Contract Specification（工具契约规范）

- 版本：0.1.0-draft（本规范的变更遵循 §8 演进规则；契约版本号独立于 zen-udf 包版本）
- 状态：基石规范——zen-udf 各语言实现（当前 TypeScript 参考实现 + 未来移植版）的
  统一约束；多语言移植的验收 = 通过 §7 conformance 全量 fixtures
- 语言：本规范语言中立；规范性（normative）部分以 MUST/SHOULD/MAY 表述（RFC 2119 语义）
- 出处：ADR-009（生态分层/namespace 立法/语义三元）、ADR-011（参数声明统一/defineTool）、
  执行规范 §6（U7）、861 例回归语料与 A3 端点实测教训

## 1. 定位与范围

本规范约束 zen-udf 生态中**自定义函数工具**的：声明契约（§3）、组织与注册（§4）、
执行语义（§5）。不约束：表达式语言语义（见 zen-expression 及其回归语料）、执行策略
的**实现**（超时/并发/出网控制属端口注入，见 §6）、宿主的租户与权限模型。

一个语言实现（reference implementation 或移植版）要自称「zen-udf 兼容」，MUST 通过
§7 的 conformance fixtures 全集。

## 2. 术语

- **Tool（工具）**：最小可注册单元 = 声明契约（§3）+ 处理器（handler）；
- **Pack（包）**：工具的命名集合 + 包元数据，可序列化为语言中立 JSON；
- **Registry（注册表）**：运行时持有已注册工具的容器，提供 §5 三动作；
- **规范表示（canonical representation）**：注册后运行时内部持有的唯一表示——
  JSON Schema 形态的 input/output 契约 + 语义与元数据字段。任何声明形态
  （§3.3 的便利形态）MUST 在注册期归一化为规范表示；运行时读点 MUST 只消费规范表示。

## 3. 工具声明契约

### 3.1 身份

| 字段          | 类型    | 约束                                                                                                                                                  |
| ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `namespace`   | string  | 非空；MUST NOT 使用保留前缀（`zen`/`core`/`reference`/`builtin` 的精确名或点分前缀，ADR-009 立法）；行业/宿主包 MUST 带 `{pack-id}.{domain}` 形态前缀 |
| `name`        | string  | namespace 内唯一；跨 namespace 重复 → 注册失败，除非该工具显式 `overwrite`                                                                            |
| `title`       | string? | 目录显示名（缺省用 name）                                                                                                                             |
| `description` | string  | 第一行为摘要（目录卡/补全悬浮用）                                                                                                                     |

### 3.2 语义与治理

| 字段         | 类型                                                                                    | 约束                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `semantics`  | `query` \| `observe` \| `act`                                                           | 缺省 `query`。query=纯读；observe=观测累积（回放读 journal 不重执行）；act=处置效果。**act 工具 MUST 声明 `idempotent: boolean`**（缺失 = 注册失败） |
| `idempotent` | boolean?                                                                                | 仅 act 语义有意义：true=重放安全                                                                                                                     |
| `deprecated` | `{since?, note}?`                                                                       | 弃用标记：目录/补全/校验告警 MUST 透传                                                                                                               |
| `meta`       | `{origin: reference\|extension\|industry, version: string, license?: oss\|proprietary}` | pack 级元数据（ADR-009 最小集纪律：字段一旦发布即兼容面，只减不增需重大版本）                                                                        |

### 3.3 参数与返回值契约

- `input`：**JSON Schema 对象**（`type: 'object'` + `properties` + `required`）——
  唯一契约来源；位置参数序 = `properties` 键序（实现 MUST 保持键序稳定）；
- `output`：JSON Schema 对象，返回值契约（校验语义见 §5.4）；
- **required 语义**：`required` 数组中的属性为必填；`required` 数组是必填性的
  **唯一权威**（无 default 不隐含必填——对齐 JSON Schema 标准语义；有损派生是历史
  缺陷，见 ADR-011 评审注记）；实现 MUST NOT 丢失 required 信息；
- **便利声明形态**（MAY 提供，语言本地）：扁平 `parameters: {名: {type, description,
default}}` 等。任何便利形态 MUST 在注册期归一化为 input JSON Schema：
  扁平无 default = 必填（进 `required`）；键序保留；`required` 数组显式给出时以
  schema 为准。**声明形态可自由并存，内部规范表示唯一**。

### 3.4 处理器与执行上下文

- 处理器签名（语义形态）：`run(input, ctx) -> output | Promise<output>`；
  `input` 为 §3.3 input schema 校验后的值；`ctx` 为执行上下文（tenant 标识、超时
  信号、日志等），由运行时注入——**执行策略不进处理器签名、不进声明契约**（§6）；
- 处理器 MUST 纯依赖 `input` 与 `ctx`（query 语义）；act 语义的副作用 MUST 满足
  `idempotent` 声明。

### 3.5 examples（conformance 即声明）

工具声明 MAY 携带 `examples: [{input, output}]`（合法 JSON 值，非 JSON5）。每个
example 生成三条 conformance 断言（§7）：input 经 §5.2 校验通过、§5.3 绑定逐字段
等于 input、§5.4 调用结果等于 output。**examples 是跨语言 conformance 的首选来源**；
无 examples 的工具不参与自动 conformance（仍受 §5 语义约束）。

## 4. Pack 组织与注册

- Pack = `{ id, namespace 根, meta, tools[] }`，MUST 可序列化为语言中立 JSON
  （多语言移植的交换形态；处理器以引用/注册函数形式随语言落地）；
- 注册语义（deploy 期，fail fast）：
  - 形状校验失败 → 整体失败；
  - namespace 保留前缀违例 → 失败；
  - pack namespace 重复 → 失败；
  - 跨 pack 工具名重复 → 失败并**列出已注册来源 namespace**，除非工具显式
    `overwrite`（后注册者覆盖）；
  - act 工具缺 idempotent → 失败（0.x 为警告，1.0 冻结为失败）；
- 注册入口唯一（语言实现 MAY 保留旧入口为兼容桥，MUST 打弃用告警）。

## 5. 执行语义

运行时对每个工具 MUST 提供三动作，语义如下（错误码为 normative）：

### 5.1 位置参数序

`parametersOrder(schema)` = input schema `properties` 的键序。位置调用约定按此序。

### 5.2 validate(input | positional args) → 错误清单

- 缺必填属性（对象式调用）或缺必填位置参数（位置式调用）→ `INVALID_PARAM` 错误，
  **MUST 列出参数名与位置**；
- 显式 `overwrite` 的 schema 子树（复杂类型：嵌套/anyOf/$ref/联合 type）不参与
  位置绑定与类型矫正，MUST 在校验结果中标注「无位置绑定」；
- 任何缺失/类型错误 MUST 结构化返回——**禁止静默填充**（空串/零值/undefined 回退
  均为规范违例）。

### 5.3 bind(input | positional args) → kwargs

- 必填缺失且无 default → 错误（与 validate 同源）；
- 有 default → 回退 default；
- 类型矫正按属性声明的简单 `type`（string/number/boolean）；复杂类型原样透传；
- **MUST NOT 用空值/空串补位必填**。

### 5.4 call(input, ctx) → output | 结构化错误

- 流程：validate → bind → 处理器 → （可选）output 契约校验；
- 错误码（normative）：

| 错误码           | 语义                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `INVALID_PARAM`  | 参数缺失/类型违例（§5.2，列参数名与位置）                         |
| `UDF_TIMEOUT`    | 超时端口触发                                                      |
| `INVALID_RESULT` | 返回值契约违例（output schema 断言；运行时档位可配 warn/enforce） |
| `UDF_LIMITED`    | 并发闸拒绝                                                        |
| `UDF_ERROR`      | 处理器自身错误（原始错误经脱敏）                                  |

- **脱敏**：错误信息 MUST 经脱敏管道（路径/凭证类值替换为占位）后暴露。

## 6. 执行策略边界（机制/策略分界）

超时、并发闸、出网控制（EgressGuard）、secret 解析、重试**不属于本契约**——它们是
宿主经端口注入的执行策略（RateStore/ConcurrencyLimiter/EgressGuard/SecretResolver，
ADR-009/执行规范 §6.2-6.4）。语言实现 MUST 提供这些端口的接入点；端口实现可随
部署后端语言不同。契约只约束：端口触发时错误码语义（§5.4）与 ctx 的字段约定。

## 7. Conformance 协议

- **fixtures 格式**（语言中立 JSON）：

```json
{
  "contract": "0.1.0",
  "cases": [
    {
      "tool": { "/* 声明契约 §3 */": "..." },
      "actions": [
        { "action": "validate", "args": [], "expect": { "errors": ["income is required (position 1)"] } },
        { "action": "bind", "args": [600, 8000], "expect": { "kwargs": { "base": 600, "income": 8000 } } },
        { "action": "call", "input": { "base": 600, "income": 8000 }, "expect": { "output": { "score": 640 } } }
      ]
    }
  ]
}
```

- **移植验收**：全量 fixtures 通过 = 兼容实现；工具声明携带的 `examples`（§3.5）
  自动编译为 fixtures；
- **fixtures 即规范的遗嘱**：规范文档修订 MUST 同步 fixtures；冲突以 fixtures
  为准（可执行）。

## 8. 版本与演进

- 契约版本独立语义化：**破坏性变更升 major， additive 升 minor**；
- zen-udf 1.0 冻结条件：本契约 major=1 + 端口面（§6）冻结——此后声明字段与错误码
  只进不退；
- 语料与 fixtures 随上游（gorules/zen）基线滚动更新；实现升级 MUST 先过全量
  conformance 与回归语料。

## 9. 参考实现状态

| 语言       | 状态                                                                                | 位置      |
| ---------- | ----------------------------------------------------------------------------------- | --------- |
| TypeScript | 参考实现（0.11.0 起对齐本规范：tool()/pack() + R1 直读规范表示 + conformance 导出） | 本包 src/ |
| 其他语言   | 未开始；触发 = 真实部署后端语言出现                                                 | —         |
