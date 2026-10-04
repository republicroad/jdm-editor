# 决策文档：`$` 解析机制与作用域边界（dt 单元格 / 表达式节点 / kwargs）

- 日期：2026-10-04
- 状态：**立法（legislative）**——机制出处为 zen 仓源码实证（Rust 行号级）；
  宿主语义描述已实证对账
- 关联：CONTRACT.md §11（调用形态）、§11.5（实例依赖调度）、§11.6（TypedValue
  信封）、ADR-016 OQ7（seal 仓对账档）

## 1 · 机制：`$` 是 isolate 的 dollar 局部变量

zen-expression 的求值 isolate 维护一个 `$` 局部变量，两个写入口：

| 写入口 | 语义 | 源码 |
| --- | --- | --- |
| `insert_dollar(path, value)` | 向 `$` 对象 dot_insert 键值 | `core/expression/src/isolate.rs:80` |
| `set_reference_value(value)` | 整体换绑 `$` 到某对象 | `isolate.rs:108` |

谁调用它们，`$` 就指向谁——**`$` 的语义是求值器状态机，不是全局常量**。

## 2 · 三面作用域边界（实证 + 源码出处）

| 面 | `$` 绑定 | `$.fieldx` 语义 | 源码出处 |
| --- | --- | --- | --- |
| **表达式节点** | 每行求值后 `insert_dollar(key, output)`——前行输出累积 | 前行输出 fieldx（`$.a+$.b` 行内顺序引用） | `core/engine/src/nodes/expression/mod.rs:51` |
| **决策表单元格（列已设 field）** | `set_reference(field)`——`$` 换绑为列 field 对象 | 列 field 对象下的 fieldx（如 field=cart → `$.fieldx`=cart.fieldx） | `core/engine/src/nodes/decision_table/mod.rs:335-338`（`row_matches`：`set_reference(field)` + `run_unary`） |
| **决策表单元格（列未设 field）** | 无换绑——单元格表达式对整行输入直接 `run_standard` | `$` 无绑定/承前状态；**裸键 `fieldx` = 输入根 fieldx**（推荐写法） | `mod.rs:338-341`（`None => run_standard(rule_value)`） |
| **自定义节点 kwargs** | **从未接通 dollar 作用域**（standalone 绑定无 insert/set_reference 调用） | `$.fieldx` 恒 null——字段引用用裸键/点路径或 reference 信封 | 本仓 `engine.ts` 具名分支（evaluateExpressionSync 直评） |

## 3 · 裁定

1. **dt 单元格与表达式节点的 `$.` 语义为 zen-engine 原生行为**（wasm 求值器
   内建，kernel 无预处理）——CONTRACT dt 求值域以此为准；两侧实证：
   表达式节点 `{a,b,c:$.a+$.b→3}`、dt 列=cart 时 `$.fieldx=='X'` 命中
   （宿主编辑器模拟器截图 + 本仓 DecisionRuntime 全图探针 `$.country` 命中）；
2. **kwargs 侧维持不接通**（ADR-016 OQ7 裁定维持）：字段引用用裸键/点路径或
   reference 信封；接通需在 standalone 入口接 dollar 作用域，与 0.15 替换器/
   ADR-016 信封识别三面交叠，收益不抵风险；
3. **dt 列未设 field 的分支**：裸键 = 输入根（入参命名空间）为推荐写法；
   `$` 承前语义依赖执行顺序，不建议依赖。

## 4 · 差异根源备查

表达式节点/kwargs 同为「字符串表达式求值」，行为却不同——因为求值入口不同：
表达式节点走引擎 isolate（dollar 作用域已接通），kwargs 实参走 standalone
绑定（`evaluateExpressionSync`，无 dollar 接通）。**同一表达式语法，三种
isolate 状态 = 三种语义**——这是 `$` 作用域边界表的机制本质。

## 5 · 维护

- zen-engine 升级后如 `$` 语义变化（如 standalone 接通 dollar），须重跑
  `adr015-inline-schedule.test.ts` 的 `$.fieldx` 用例与 `dt-dollar-scope`
  用例（当前 skip 挂起，恢复时走 DecisionRuntime 路径）并更新本文档；
- 多语言移植版 MUST 在对应面复现同一边界（表达式节点/单元格 `$` 可用、
  kwargs `$` 恒 null 或显式报错），并入 §7 conformance 档位验收。
