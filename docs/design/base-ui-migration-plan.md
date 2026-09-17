# Base UI 全量迁移计划（v2）

- 日期: 2026-09-16（v1）→ **2026-09-17（v2 实测刷新）**
- 状态: **draft —— 已规划，执行时机待决策**（v1 裁决：整体移至 v1.0 分叉后在 verdict-weave 仓执行，jdm-editor v1.0 贡献态保持 radix 现状，见 [verdict-weave 迁移计划](./verdict-weave-migration-plan.md) §0/§4）
- v2 刷新动机: 迁移面单日增长实测（158→239）；Base UI 1.8.0 发布；usese 依赖链定论（ADR-006）
- 目标: kernel / appshell / playground 的 UI 原语从 radix 全量迁至 Base UI（`@base-ui/react`）
- 动机: 对齐 ReUI base-nova 主线；根治 flow 块风格错配（[issue 草稿](./reui-flow-toggle-group-style-mismatch.md)）；收敛依赖为单一引擎

## 1. 迁移面盘点（2026-09-17 实测）

| 项 | 数量 | 说明 |
| --- | --- | --- |
| kernel wrapper | 14 文件 / 13 族 | 统一包 `radix-ui` ^1.6.7：Tooltip/Tabs/Switch/Select/RadioGroup/Popover/Label/DropdownMenu/Dialog/ContextMenu/Checkbox/AlertDialog/Slot |
| appshell wrapper | 14 radix 文件 / 14 族 + 8 文件已在 Base UI | 零散包 `@radix-ui/react-*` ×14（package.json 已声明）；`@base-ui/react` ^1.7.0 已是直接依赖 |
| playground | `@base-ui/react` ^1.7.0 已声明 | 消费面随 appshell 走 |
| 样式选择器（全仓） | **239 处** | `data-[state=open]`×94、`closed`×86、`active`×25、`checked`×19、`unchecked`×10、`on`×4、`selected`×1 |
| 动画面 | 全部浮层组件 | `animate-in/out` + `--radix-*` CSS 变量 |
| 依赖收敛 | → 1 个 | `radix-ui`（kernel）+ 14 个 `@radix-ui/react-*`（appshell）→ `@base-ui/react` |

**增长趋势（v2 关键新事实）**：v1 实测 158 处选择器，一日内升至 239——reui-showcase、
directory-page、schema-container-tab 等新面均按 radix 样式约定落地。**每加一个功能，迁移面
就涨一截；推迟执行不是零成本，是计息负债。** 若维持裁决（分叉后执行），应同时冻结「新面按
radix 写」的默认路径。

**覆盖核验**：Base UI 1.8 已含全部所需原语（含 scroll-area、menu、menubar、toggle(-group)、
tooltip、toast、toolbar、field）——**零缺口**。上游发版节奏约每月一版（1.6 六月 / 1.7 八月
/ 1.8 九月），活跃健康。

## 1.1 usese 依赖链定论（ADR-006 后果节同步）

- `@base-ui/react` 1.8.0（latest）仍依赖 `use-sync-external-store ^1.6.0`（`@base-ui/utils`
  源码注释：为支持 React 17；peer `^17 || ^18 || ^19`）。
- 结论：**迁移到 Base UI 不消除 appshell 的 usese external 正则**——该正则的归因从
  「zustand/traditional 链」改为「@base-ui 链」（vite.config 注释已更新）；除非上游放弃
  React 17，正则长期保留。
- React 19 运行时无感知：shim 检测版本后委托原生 API；多副本无害（无单例语义，lockfile
  已 1.2.2/1.6.0/1.7.0 三版共存）。
- 对照：**radix 全系（统一包 + 全部 `@radix-ui/react-*`）零 usese 依赖**（dist 实测无引用）——
  其状态模型是受控/非受控组件态，不走外部 store 订阅。推论：radix→Base UI 迁移会把 usese 链
  **新引入 kernel**，届时 kernel vite.config 需补 `/^use-sync-external-store(\/.*)?$/`
  external（appshell 已有，kernel 现无——批 2/3 的验收清单加此项）。

## 2. 对照表与 API 差异点

| radix | Base UI | 差异要点 |
| --- | --- | --- |
| DropdownMenu | **Menu** | 组件改名；RadioItem/CheckboxItem/ItemIndicator 模式不同 |
| Dialog / AlertDialog | 同名 | `asChild` → `render` prop；Portal/Backdrop 结构差异；`data-state=open` → `data-open` |
| ContextMenu | 同名 | 同 Menu 系 |
| Select | Select | trigger 用 render；ItemIndicator 模式；typeahead 行为需回归 |
| Popover | Popover | anchor/side 属性大体对应；transform-origin 变量换名 |
| Tooltip | Tooltip | Provider/delay/side 命名差异 |
| Tabs / Switch / Checkbox / RadioGroup / Separator / Avatar / ScrollArea / Toggle(+Group) | 同名 | 属性相近，data-* 命名不同（直接 data-open/data-checked，无 state 值域） |
| Slot | 无独立组件 | `useRender` + `render` prop 模式替换（2 处使用） |
| 动画 | — | `animate-in/out` + radix transform-origin 变量 → Base UI transitions（`@starting-style` / data-open\|closed 类）；**隐性工时大头** |

## 3. 分批（四批 + 准备，批间可独立发布/回退）

**批 0 准备（0.5 天）**
- 冻结基线：kernel/appshell 现有测试与 storybook 清单（每族标注交互点：焦点、Escape/外点关闭、退场动画）
- wrapper 来源策略：ReUI base registry 已有的直接装（badge/alert/icon-tile 等），缺失的按 base-nova 风格手写
- `@base-ui/react` 收进 pnpm catalog（现为 appshell/playground 各自 `^1.7.0`，升 1.8.0 时统一）
- 每批一 PR，批内可 revert（wrapper 隔离保证回退面 = 单批文件）

**批 1 appshell（1–2 天）**——**建议从裁决中拉前到本仓执行**（见 §5 决策 1 选项 b）
- 14 个 wrapper 换代 + 选择器改写（appshell 是 verdict 专属壳，不进上游贡献线，提前迁零冲突；且 8/14 文件已在 Base UI，惯性最强）
- 验收：appshell 测试；playground 六页回归（Sheet 面板/皮肤槽位/版本历史）；发布 minor（宿主可见面：仅内部 data 属性样式覆盖需备案）

**批 2 kernel 菜单/浮层族（2–3 天，最重）**——verdict-weave 仓执行
- Select / DropdownMenu→Menu / ContextMenu / Popover / Tooltip
- 验收：decision-graph storybook 交互回归（节点右键、组件面板下拉、配置弹层、模拟器面板）

**批 3 kernel 表单/反馈族（1–2 天）**——verdict-weave 仓执行
- Dialog / AlertDialog / Checkbox / RadioGroup / Switch / Tabs / Label / Separator / Slot→render 化 / 动画面整体切换
- 验收：同上 + `pnpm size` 不劣化 + build

**批 4 收尾（1 天）**
- 选择器清零门禁写进 verify：`grep -r "data-\[state=" packages → 0`
- 依赖移除：`radix-ui` 与 14 个 `@radix-ui/react-*` 全撤
- flow 块处理：等 `/r/base/flow-*.json` 上线（issue 跟踪）后重装、撤 radix 翻译补丁；补齐前 flow.html 临时保留 `radix-ui` 或下架试点
- 文档：troubleshooting 记一笔 + 宿主迁移备案（data 属性覆盖警告）

## 4. 风险登记

| 风险 | 缓解 |
| --- | --- |
| 迁移面持续增长（v2 实测 +81/日） | 决策 1 尽快落锤；若推迟则冻结 radix 新面 |
| Base UI 1.x 较年轻（焦点 trap/typeahead/组合键等边角） | 每族配交互手测清单；单族卡壳批内 revert |
| 动画回归（隐性工时大头） | 批 3 单列动画面；视觉走查暗色模式 |
| 宿主样式覆盖（仓外唯一波及点） | 迁移前 grep editor/verdict 对内部 data 属性的覆盖，出备案清单 |
| ReUI flow 块 base 变体未发布（外部依赖） | issue 已起草；批 4 前不阻塞其他批 |
| usese shim 随 Base UI 长期存在 | 无 React 19 运行时影响；external 正则保留（ADR-006） |
| 上游同步 | 硬分叉已断（独立版本线），无 radix→base 的上游合并负担 |

## 5. 工作量与决策点

**总量**：约 5–8 个工作日，批间可跨周拆分；批 1/2/3 各自独立可发布。

**待决策**：
1. **执行范围**（v2 重开）：
   - a. 维持 v1 裁决：全部推迟到 verdict-weave（前提：同步冻结 radix 新面，否则负债计息）
   - b. **拉前批 1（appshell）到本仓**：verdict 专属壳不进贡献线，8/14 文件已在 Base UI；
     kernel 批 2/3 仍按裁决推迟 —— 推荐项，性价比最高
   - c. 全量在本仓执行：与「v1.0 贡献态保持 radix」裁决冲突，不推荐
2. kernel 各批的发布节奏：逐批发 minor vs 攒一个 0.x 大版本（verdict-weave 仓内决策）
3. flow 块过渡策略：等 base 上线 vs 临时双引擎
