# zen-expression 时间表达式：业务常用清单与能力盘点

- 日期：2026-09-29
- 状态：活档 · 上游 issue 候选池
- 证据方法：① zen-expression 回归语料 861 例（[expression-regression](../../packages/zen-udf/src/expression-regression/)，
  Rust 基线 61862ab）；② @gorules/zen-engine@2.1.0 实测探针
  （`packages/zen-udf/scripts-time-probe.mjs`，69 项业务表达式逐条验证）；
  ③ dt 域重叠探针（`packages/zen-udf/scripts-dt-overlap-probe.mjs`，2026-09-30）
- 关联：[dt-datagrid-retrofit-plan.md](./dt-datagrid-retrofit-plan.md)（同目录）、
  zen-udf contrib `dt` 域（convert/business_day/diff）

## 目的

盘点决策业务中常用的时间表达式与 zen-expression（@gorules/zen-engine 2.1.0 JS 绑定）
的现有能力，标记三类状态：

- ✅ **已有**——内建可用，业务直接使用；
- ⚠️ **部分/受限**——可用但有语义或环境限制（标注限制内容）；
- ❌ **缺失**——内建没有，作为向 zen-engine 上游提 issue 的候选（或由 zen-udf
  contrib 域先行补齐）。

> 提交 issue 属对上游的沟通动作，按「上游贡献转手动」裁决由宿主手动执行；
> 本文档提供现成的 issue 素材（复现表达式 + 期望语义 + 优先级）。

## 现状基线与语义注意点

- 引擎：`@gorules/zen-engine@2.1.0`（2026-09-29 发布，date 子系统较 2.0.2 大幅补齐）；
- **裸日期绑定本地时区**：`d('2023-10-15')` 在 +08:00 环境返回
  `2023-10-15T00:00:00+08:00`（UTC 环境返回 Z）——日期字面量的 zone 语义随环境，
  跨环境比较需显式带 zone 或用 `.timestamp()`；
- **format 的 `%B/%b` token 缺口**：2.1.0 中 `%B`（月名）`%b`（缩写月名）在
  Z 后缀输入上返回 NaN（回归语料台账在案）；`%A/%a/%Y/%m/%d/%H/%M/%S/%s/%.3f`
  均正常；
- 回归语料 861 例中 6 例为环境渲染差异，已台账
  （[expression-regression.divergences.json](../../packages/zen-udf/src/expression-regression.divergences.json)）。

## 业务清单（按使用频率排序）

### A · 解析与构造

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `d('2023-10-15')` | ISO 日期 | ✅ |
| `d('2023-10-15T14:30:00Z')` | ISO 带 Z / 任意 offset | ✅ |
| `d('2023-10-15 14:30')` | 空格分隔 | ✅ |
| `d('2023/10/15')`、`d('20231015')` | 斜杠 / 紧凑格式 | ✅（2.1.0 起支持） |
| `d('2023-10-15', 'Europe/Berlin')` | 构造时指定时区 | ✅ |
| `d(1697328000000)` | epoch 毫秒构造 | ✅ |

### B · 当前时间

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `now()` | 风控「当前时刻」类规则（高频） | ❌ 缺失 |
| `today()` | 「今天」日期（对账/T+1 类规则） | ❌ 缺失 |
| `$now` 变量 | 引擎内置变量 | ❌ 缺失（未定义变量得 null） |

**现状替代**：宿主在 input 注入 `$currentDate`（verdict/UDF Lab 现行做法）——可用但
每条规则都要显式传参，内建后表达力显著提升。**issue 优先级 P1**。

### C · 分量取值

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `d(...).year()/.hour()/.minute()/.day()/.weekday()` | 链式取值 | ✅ |
| `d(...).quarter()` | 季度号（季报规则） | ✅ |
| `year(d(...))` 独立函数形态 | 函数式风格 | ✅（仅 year） |
| `month()/day()/hour()/minute()/second()` 独立函数形态 | 同上 | ❌ 缺失（parserError） |

**说明**：链式形态已覆盖取值需求；独立函数形态属风格一致性缺口。**issue 优先级 P3**。

### D · 算术与差值

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `.add('1d 5h')` / `.add(1, 'd')` | 加时长（字符串/数值双形态） | ✅ |
| `.sub('2d')` / `.sub(1, 'M')` | 减时长（含跨月） | ✅ |
| `.diff(d(...), 'd'/'h')` | 两日期差值（账龄/超时计算） | ✅ |
| `.add('P1DT5H')`（ISO 8601 duration） | 标准时长字面量 | ❌ 缺失（P2） |

### E · 边界与截断

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `.startOf/.endOf('day'/'month'/'year'/'week'/'quarter'/'hour')` | 月初月末/季初/周初（账期规则高频） | ✅（六种粒度全通） |

### F · 时区

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `.tz('Asia/Shanghai')` | 时区转换（跨境业务） | ✅ |
| `d(..., 'UTC')` 构造指定时区 | 跨境规则锚定 | ✅ |
| `.toTimezone('UTC')` | 转换（dayjs 风格 API） | ❌ 缺失（有 `.tz()` 等价物，P3） |

### G · 格式化

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `.format('%Y-%m-%d')` / 全量 strftime 组合 | 报文输出格式（高频） | ✅ |
| `.format('%A/%a/%s/%.3f')` | 星期名/epoch 秒/毫秒 | ✅ |
| `.format('%B/%b')` | 月名 token | ⚠️ **Z 输入返回 NaN**（2.1.0 token 缺口，回归台账在案） |

### H · 比较

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `d(a) > d(b)`、`==`、`!=` | 日期比较（超期判定高频） | ✅ |
| `d(a) > '2023-10-14'` | 与字符串字面量直接比 | ✅ |
| `d(a) in [d(b), d(c)]` | 名单成员 | ✅ |
| `.isBefore/.isAfter/.isSame` | dayjs 风格判定 | ✅ |
| `.isBetween(a, b)` | 区间判定（活动有效期类，高频） | ❌ 缺失（P1——可用 `a<x and x<b` 替代，表达力损耗） |

### I · 时间戳

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `.timestamp()` | epoch 毫秒 | ⚠️ 可用，但裸日期按本地绑定（值随环境，跨环境比对需注意） |
| `.format('%s')` | epoch 秒 | ✅ |
| `d(...).unix()` | epoch 秒（dayjs 风格） | ❌ 缺失（`%s` 可替代，P3） |

### J · 业务日（金融/风控高频）

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| 工作日判定 / 加减工作日 | T+N 结算、催收时限 | ❌ 内建缺失 |
| 假日表驱动的业务日历 | 节假日调整 | ❌ 内建缺失 |

**现状替代**：zen-udf contrib `dt` 域已实现 `dt.business_day`（节假日表为数据参数）。
内建化需上游引入日历概念——建议**保持 zen-udf 域实现**，不提 issue（机制/数据分界，
假日表属数据注入，与上游「无内置数据」取向一致）。

### K · 月/年/周派生

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `.isLeapYear()` | 闰年 | ✅ |
| `.daysInMonth()` | 月内天数（分期计划） | ❌ 缺失（P2，可 `endOf('month').day()` 替代） |
| `.isoWeek()` | ISO 周号（周报口径） | ❌ 缺失（P2） |
| `.isWeekend()` | 周末判定 | ❌ 缺失（P2，可 `.weekday() in [6,7]` 替代——注意 weekday 取值口径需实测） |

### L · 相对时间与可读化

| 表达式 | 业务场景 | 状态 |
| --- | --- | --- |
| `.fromNow()` | 「3 天前」类可读化（通知文案） | ❌ 缺失（P3，通知场景由 zen-udf notify 域/宿主文案层承担更合适） |

## 上游 issue 提案包（按优先级）

| 优先级 | 提案 | 素材 |
| --- | --- | --- |
| **P1** | `now()` / `today()` 内建（可带可选 tz 参数） | 本文档 B 节；风控/对账规则最高频缺口 |
| **P1** | `isBetween(start, end)` | H 节；dayjs/day.js 生态通行 API |
| **P2** | `%B/%b` format token 修复 | G 节；Z 输入 NaN，复现一行 |
| **P2** | `daysInMonth()` / `isoWeek()` / `isWeekend()` | K 节；dayjs 生态通行 |
| **P2** | ISO 8601 duration 输入（`add('P1DT5H')`） | D 节；标准时长字面量 |
| **P3** | month/day/hour/minute/second 独立函数形态、`unix()`、`toTimezone()`、`fromNow()` | C/F/I/L 节；风格一致性 |

> issue 提交模板：复现表达式 + 实测输出 + Rust 基线期望（本语料可直接引用：
> `core/expression/tests/data/date.csv` 对应行）+ 业务场景一句话。

## 与 zen-udf contrib `dt` 域的分工（0.11.x 重叠 review，2026-09-30）

> 逐工具×逐能力实测判定（探针 `packages/zen-udf/scripts-dt-overlap-probe.mjs`，
> @gorules/zen-engine@2.1.0；内建语义以回归语料 date.csv Rust 基线为对照锚）。

| dt 工具 | 2.1.0 内建对应 | 重叠判定 | 处置 |
| --- | --- | --- | --- |
| `dt.convert` | `d(x).tz(z).format('%Y-%m-%dT%H:%M:%S')` | **转换本体已内建**：同输入输出逐字符相等（`2026-09-30T20:00:00`），DST 正确（冬令时 12:00Z→07:00）。差异仅错误通道——内建非法时区抛 vmError（表达式硬中断），dt 域返回结构化 `{datetime:null, error:'INVALID_TIMEZONE'}` | **保留，定位收窄**为「IANA 时区校验 + 结构化错误」工具；纯表达式内联转换场景优先内建 `tz()+format`（fail fast 语义本就合理） |
| `dt.diff` | `.diff(d2, 'd'/'M')` | **days 重叠**（差符号约定：内建有符号 `-14`，dt 域恒绝对值）；**months 语义分歧实锤**——内建 `'M'` 为 anniversary 完整月数（`11-30→2-28 = 3`），dt 域为「月序差−日不足调减」（`= 2`）；**business_days 内建无对应**（`Invalid duration unit`） | **保留**：days 场景业务可迁内建（注意符号）；months 双口径并存须业务先裁口径（按完整月还是按月序调减）；business_days 为唯一能力单元 |
| `dt.business_day` | 无——仅 `weekday()` 取值（实测周六=6，dayjs 0=周日口径），无假日/日历概念 | **零重叠** | **长期保留**（假日表=数据注入，机制/数据分界，与上游「无内置数据」取向一致） |

- **分工总纲**（承旧版结论，经实测校准）：业务日历（business_day）是 dt 域的
  不可替代核；convert/diff 与内建的重叠部分不构成废弃理由——dt 域的价值在
  **结构化错误通道**与**业务口径包装**（绝对值/调减语义），两者都是表达式内联
  做不到的；上游补齐纯机制项（now/isBetween）与本分工互不影响；
- **两实现防漂移**已就位：内建语义由回归语料 861 例（Rust 基线）钉住，dt 域
  语义由 datetime.test.ts 钉住——语料即对照基准；
- dt 域三工具均**不打 deprecated**（1.0 注册 API 收敛不涉及 contrib 语义面）。

## 维护

- 每次升级 `@gorules/zen-engine` 后重跑 `scripts-time-probe.mjs`，更新本文档状态列；
- 回归语料（861 例）随 Rust 基线滚动 vendor，分歧台账按三契约维护；
- 新增「业务常用」条目时先跑探针再入表——状态列只认实测。
