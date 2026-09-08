# 自然语言规则编辑（业务视图）

> 决策表单元格如何渲染成「字段 + 操作符 + 类型化值」的自然语言控件，以及它如何保持为
> 表达式字符串的纯投影。已对照本 fork（`main` 分支）取证，附源码锚点。

## 一、心智模型

业务视图**没有独立状态**。每个条件/输出单元格保存的是 zen 表达式字符串；
`ExpressionBuilder`（unary 条件）与 `StandardExpressionBuilder`（输出值）通过 WASM
把字符串解析为结构化数据、据此渲染类型化控件，再把用户编辑序列化回同一字符串。
业务视图与 dev 视图（CodeMirror）编辑的是同一份数据，永不漂移。

## 二、快速上手

```bash
npm i @republicroad/jdm-editor
```

```tsx
import '@republicroad/jdm-editor/dist/style.css';
import { DecisionTable, JdmConfigProvider } from '@republicroad/jdm-editor';

<JdmConfigProvider
  dictionaries={{ tierDict: [{ label: '金牌会员', value: 'GOLD' }] }}
>
  <DecisionTable value={table} onChange={setTable} mode="business" tableHeight={400} />
</JdmConfigProvider>
```

- `mode="business"` 开启自然语言单元格（见 `DecisionTableEmptyType.mode`，
  `src/components/decision-table/dt-empty.tsx`）；默认 `mode="dev"`（CodeMirror）。
- `dictionaries` 可按组件传入，也可经 `JdmConfigProvider` 注入（组件 prop 优先）。
- 输入列的 `fieldType`（输出列的 `outputFieldType`）决定渲染的控件形态；WASM 未就绪
  时表格自动退回 dev 单元格，不会白屏。

## 三、列类型 schema（`src/helpers/schema.ts`）

```ts
columnEnumSchema     = { type: 'inline', values: {label,value}[], loose?: boolean }
                     | { type: 'ref', ref: string, loose?: boolean }

columnFieldTypeSchema = { type: 'any' }
                      | { type: 'string', enum?: columnEnumSchema }
                      | { type: 'number' } | { type: 'boolean' } | { type: 'date' }

outputFieldTypeSchema = { type: 'auto' }
                      | { type: 'string', enum? } | { type: 'string-array', enum? }
                      | { type: 'number' } | { type: 'boolean' } | { type: 'date' }
```

仅 `string`/`string-array` 列可挂 `enum`。枚举编辑界面（inline 行内编辑，行格式
`label;value`；或引用字典）位于
`src/components/decision-table/components/enum-utils.ts` / `input-field-edit.tsx`。

## 四、业务模式下各单元格的形态

| 单元格 | 控件 |
|---|---|
| string + 枚举 | 操作符图标 + 业务标签下拉（显示 `label`，存储 `value`；`loose` 允许自由输入） |
| number | 操作符下拉（equals / greater than / between…）+ 数字输入；`between` → `[a .. b]` 区间控件，括号可切换开闭 |
| date | 日期选择器 + 粒度（exact/week/month/quarter/year）；`dayOfWeekIn` → 周一至周日芯片，`quarterIn` → Q1–Q4 芯片 |
| 输出列 | 类型化值输入 ⇄ 表达式模式切换（CodeMirror）；带枚举的 string 输出渲染下拉 |
| 任意格 | 操作符面板底部「custom」磁贴 = 开发者表达式模式；复杂到无法结构化的表达式自动强制 custom |

## 五、操作符 → 落库表达式（规范形态）

用户点选生成的是、也只能回写成这些字符串（对照 `@gorules/zen-engine-wasm`
0.23.1 实测，见 `src/helpers/wasm-roundtrip.test.ts`）：

| 操作符（结构化 `type`） | 序列化后的 unary 表达式 |
|---|---|
| `eq` / 字面量 | `"GOLD"`、`99`、`true`（裸值 ⇒ `$ == value`） |
| `gt/gte/lt/lte` | `>= 1000`、`< 200000` |
| `between` | `[200000..1000000]`、`(1..5]`、`[1..10)`（括号即开闭） |
| `in`（列表） | `["a", "b"]` 或 `"INC","LTD","LLC"`（逗号 OR） |
| `notIn` | `not in [1, 2]` |
| `null` / `notNull` | `== null` / `!= null` |
| `contains` | `contains($, "ship")` |
| `startsWith` / `endsWith` | `startsWith($, "ORD-")` / `endsWith($, "-EU")` |
| `dateAfter` | `d($).isAfter("2024-01-15")` |
| `dayOfWeekIn` | `d($).weekday() in [1, 5]` |
| `quarterIn` | `d($).quarter() in [1, 4]` |
| `timeGt` | `d($).hour() * 60 + d($).minute() > 9 * 60 + 30` |
| 无法结构化的内容 | 原样保留，`kind: 'complex'`（custom 模式） |

以上全部是引擎可执行的 zen unary 表达式（`d($).weekday()` 对应 zen 的
`DateMethod`）。注意：`contains "x"`（缺 `($, …)`）**不是**规范形态，会被当作
complex/custom 表达式处理。

## 六、WASM 运行时契约

`src/helpers/wasm.ts` 是唯一入口：

- 依赖：`@gorules/zen-engine-wasm`，**锁死版本**（`0.23.1`，无 `^`）。升级是显式
  动作：升版本 → `pnpm test` → 处理
  `src/helpers/__snapshots__/wasm-roundtrip.test.ts.snap` 的任何漂移后才能发布。
- 加载：`initWasm({ module_or_path })`，URL 相对 `document.baseURI` 解析为
  `zen-engine-wasm/zen_engine_wasm_bg.wasm`。宿主需在该路径提供包内
  `dist/*.wasm`（显式 baseURI 解析使根路径与子路径部署均可用）。文档站/storybook
  构建在 `packages/jdm-editor/docs/zen-engine-wasm/` vendored 了该产物。
- 就绪门控：`useWasmReady()` / `isWasmAvailable()` 控制 business 模式；WASM 就绪前
  单元格以 dev 形态渲染（不白屏、不半水合）。
- 测试：`src/helpers/wasm-roundtrip.test.ts` 用 `initSync` 直接加载 node_modules 里
  的真实二进制，断言 parse→serialize 收敛、序列化幂等、规范形态恒等、校验器一致。

### 长期任务存档：表达式链路自持化（2026-09-08 搁置）

**决策：** 作为长期任务存档，暂不启动。链路继续运行在锁版本的
`@gorules/zen-engine-wasm@0.23.1` 上，round-trip 快照护栏作为漂移围栏保持有效。

**目标：** 用本组织的 `zen` 仓库（Rust）构建编辑器专用 wasm，替换上游预编译
产物，使操作符/日期函数/类型系统可自主演进，不必等上游发版。

**工作项（均未启动）：**
1. `zen-expression` 的 AST→字符串序列化器——唯一缺失件（AST 现只有编译/求值
   出口，无 unparse）。输出须与 `src/helpers/wasm-roundtrip.test.ts` 锁定的
   规范形态逐字符一致，含特例展开
   （`timeGt` → `d($).hour() * 60 + d($).minute() > 9 * 60 + 30`）。
2. 结构化 JSON 契约层（`toJson`/`fromJson` 形状与上游一致），
   `use-expression-state.ts` 零改动。
3. wasm-bindgen 绑定 + wasm32 构建管线（zen 现只有 napi/pyo3/uniffi/c 绑定）。
4. 对拍验收：扩语料（zen `test-data`、`credit-analysis.json` 等）双产物
   diff 为零后方可切换。

**预估：** 单人约 2–4 周。**解档触发：** 上游 wasm 出现不兼容变更或停更；
需要自定义操作符/类型系统；TS7/rolldown 工具链波及 wasm 链路。

**替代方案记录：** 路径 B——用 `nlTokenizeBatch` token 流重建芯片视图
（重写 UI 层，Rust 零改动；见 zen 仓库 `TODO.md`）。

## 七、引擎兼容性提醒

`fieldType`/`outputFieldType` 是**编辑器层**的富类型；引擎端 JDM 表列仍是纯字符串
type。本编辑器产出的模型交给 zen 引擎执行前，请对目标引擎版本做一次往返验证
（本组织的引擎 fork：`zen` 仓库 `core/expression` 的 unary 文法）。

## 八、源码锚点

- 构建器 UI：`src/components/code-editor/business/expression-builder/`
  （`constants.ts` 操作符目录、`value-inputs.tsx` 类型化控件）
- 输出构建器：`business/standard-expression-builder.tsx`
- 状态接线 / kind 推断：`business/expression-builder/use-expression-state.ts`
- 单元格分发（dev ⇄ business + WASM 门控）：`decision-table/table/table-default-cell.tsx`
- 公共属性：`decision-table/dt-empty.tsx`（`DecisionTableEmptyType`）
- 字典 Context：`src/theme.tsx`（`JdmConfigProvider`、`useDictionaries`）
