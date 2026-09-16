# Base UI 全量迁移计划（草案 v1，待决策）

- 日期: 2026-09-16
- 状态: **draft —— 仅规划，未决策、未执行**
- 时序追注（2026-09-16）：按 [verdict-weave 迁移计划](./verdict-weave-migration-plan.md) §0/§4，
  本迁移**整体移至 v1.0 分叉后在 verdict-weave 仓执行**——UI 迁移属 verdict 专属演进，
  不进入上游贡献线；jdm-editor 的 v1.0 贡献态保持 radix 现状
- 目标: kernel / appshell / playground 的 UI 原语从 radix 全量迁至 Base UI（`@base-ui/react`）
- 动机: 对齐 ReUI base-nova 主线（未来 UI 全面转 ReUI）；根治 flow 块风格错配（[issue 草稿](./reui-flow-toggle-group-style-mismatch.md)）；收敛依赖为单一引擎

## 1. 迁移面盘点（2026-09-16 实测）

| 项 | 数量 | 说明 |
| --- | --- | --- |
| kernel wrapper | 14 文件 / 13 族 | 统一包 `radix-ui`：Tooltip/Tabs/Switch/Select/RadioGroup/Popover/Label/DropdownMenu/Dialog/ContextMenu/Checkbox/AlertDialog/Slot |
| appshell wrapper | 14 文件 / 14 族 | 零散包 `@radix-ui/react-*`：另有 toggle/toggle-group/scroll-area/avatar/separator 等；已有 8 文件在用 Base UI |
| 样式选择器 | 158 处 | `data-[state=open]`×58、`closed`×52、`active`×14、`checked`×13、`orientation`×12、`unchecked`×6、`on`×2、`selected`×1 |
| 动画面 | 全部浮层组件 | `animate-in/out` + `fade/zoom/slide` + `--radix-popover-content-transform-origin` 等 radix CSS 变量 |
| 依赖收敛 | → 1 个 | `radix-ui`（kernel/playground）+ 14 个 `@radix-ui/react-*`（appshell）→ `@base-ui/react` |

**覆盖核验**：Base UI 1.7 已含全部所需原语（含 scroll-area、menu、menubar、toggle(-group)、tooltip、toast、toolbar、field）——**零缺口**。

## 2. 对照表与 API 差异点

| radix | Base UI | 差异要点 |
| --- | --- | --- |
| DropdownMenu | **Menu** | 组件改名；RadioItem/CheckboxItem/ItemIndicator 模式不同 |
| Dialog / AlertDialog | 同名 | `asChild` → `render` prop；Portal/Backdrop 结构差异；`data-state=open` → `data-open` |
| ContextMenu | 同名 | 同 Menu 系 |
| Select | Select | trigger 用 render；ItemIndicator 模式；typeahead 行为需回归 |
| Popover | Popover | anchor/side 属性大体对应；transform-origin 变量换名 |
| Tooltip | Tooltip | Provider/delay/side 命名差异 |
| Tabs / Switch / Checkbox / RadioGroup / Separator / Avatar / ScrollArea / Toggle(+Group) | 同名 | 属性相近，data-* 命名不同（无 state 值域，直接 data-open/data-checked） |
| Slot | 无独立组件 | `useRender` + `render` prop 模式替换（2 处使用） |
| 动画 | — | `animate-in/out` 系列类 + radix transform-origin 变量 → Base UI transitions（`@starting-style` / data-open|closed 类）；**隐性工时大头** |

## 3. 分批（四批 + 准备，批间可独立发布/回退）

**批 0 准备（0.5 天）**
- 冻结基线：kernel/appshell 现有测试与 storybook 清单（每族标注交互点：焦点、Escape/外点关闭、退场动画）
- 建 wrapper 来源策略：ReUI base registry 已有的直接装（badge/alert/icon-tile 等），缺失的按 base-nova 风格手写
- 每批一 PR，批内可 revert（wrapper 隔离保证回退面 = 单批文件）

**批 1 appshell（1–2 天）**
- 14 个 wrapper 换代 + 选择器改写
- 验收：appshell 测试；playground 六页回归（Sheet 面板/皮肤槽位/版本历史）；**发布 minor**（宿主可见面：仅内部 data 属性样式覆盖需备案）

**批 2 kernel 菜单/浮层族（2–3 天，最重）**
- Select / DropdownMenu→Menu / ContextMenu / Popover / Tooltip
- 验收：decision-graph storybook 交互回归（节点右键、组件面板下拉、配置弹层、模拟器面板）

**批 3 kernel 表单/反馈族（1–2 天）**
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
| Base UI 1.x 较年轻（焦点 trap/typeahead/组合键等边角） | 每族配交互手测清单；单族卡壳批内 revert |
| 动画回归（隐性工时大头） | 批 3 单列动画面；视觉走查暗色模式 |
| 宿主样式覆盖（仓外唯一波及点） | 迁移前 grep editor/verdict 对内部 data 属性的覆盖，出备案清单 |
| ReUI flow 块 base 变体未发布（外部依赖） | issue 已起草；批 4 前不阻塞其他批 |
| 上游同步 | 硬分叉已断（独立版本线），无 radix→base 的上游合并负担 |

## 5. 工作量与决策点

**总量**：约 5–8 个工作日，批间可跨周拆分；批 1/2/3 各自独立可发布。

**待决策**：
1. 启动与否（替代方案：维持 radix 现状，仅新面用 base——省事但双引擎长期共存，flow 错配持续）
2. kernel 各批的发布节奏：逐批发 minor vs 攒一个 0.x 大版本
3. flow 块过渡策略：等 base 上线 vs 临时双引擎
