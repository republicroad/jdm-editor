# Base UI 成果上游贡献 + 后续开发规划

- 日期: 2026-09-17
- 状态: **draft —— 待宿主裁决贡献线优先级**
- 背景裁决: 2026-09-17 宿主提出「Base UI 以后是 shadcn 主要维护方向，把这个贡献上游比较好」；
  本文档据此校准上游事实并给出可执行的贡献路径与后续开发序列

## 1. 上游事实校准（2026-09-17 实测）

`@gorules/jdm-editor@1.52.0`（npm latest，2026-05-13 修改）的 UI 栈：

| 维度 | gorules 上游 1.52.0 | 本仓 reui 分支 |
| --- | --- | --- |
| UI 引擎 | **antd 5.21.2** + @ant-design/icons | antd 已移除；tailwind 4 + shadcn → **Base UI 1.8** |
| 画布 | **reactflow 11.11.4** | @xyflow/react 12 |
| 状态 | **zustand 4.5.5**（deprecated equality API） | zustand 5.0.15 + 本地深比较 memoizer（ADR-006） |
| 校验 | zod ^3.24 | zod 4.3.6 |
| 拖拽 | react-dnd 16 | dnd-kit |
| 编辑器 | monaco | monaco（未替换） |
| React | >= 18 | 19.2.8 |

**关键结论**：上游**没有 shadcn/radix 层可供「迁移到 Base UI」**——我们的 Base UI 迁移是
把自己引入的 shadcn 层换代。直接向 gorules 提 Base UI PR 在字面上不成立；它的前置是上游
先做「antd → headless 组件栈」的架构决策。因此「贡献上游」必须拆成三条各自成立的线。

## 2. 三条贡献线

### 线 A（推荐首发）：zustand 官方文档/社区 —— 选择器相等性模式

**资产**：ADR-006 + BP-08 沉淀的两个可复用知识点：
1. `useShallow` 只救一层——嵌套派生选择器（每拍新建内部引用）在浅比较下快照不稳定，
   触发 getSnapshot 渲染循环；13 个失败测试的实证过程。
2. ref + useMemo 复刻 `useSyncExternalStoreWithSelector` 时**必须保留 hasMemo 守卫**
   （首拍不调比较器），否则自定义比较器读属性即崩——smoke 测试实证。

**形态**：向 zustand 仓库（pmndrs/zustand）docs 提 PR，补充「Comparing States」页的
custom-equality 小节（官方文档已有 useCustomEquality 配方，但未提 hasMemo 陷阱与
渲染循环失效模式）；中文实践版本留在 BP-08。
**成本**：~0.5 天（英文行文 + 对方 CI）。**风险**：低——纯文档。

### 线 B：Base UI 社区 —— jsdom 测试模式

**资产**：troubleshooting §10 的三个实证：`Element.getAnimations` 桩、退场过渡异步卸载
（断言需 waitFor）、`data-state` 值域 → presence 属性断言改写。
**形态**：向 base-ui 仓库提 testing-docs issue/PR（他们文档缺「如何在 jsdom/vitest 里测
Base UI 组件」一节）；同时可反哺 shadcn 官方 migration skill 的已知问题清单。
**成本**：~0.5 天。**风险**：低。

### 线 C（长期、需对方决策）：gorules 上游 —— UI 栈现代化提案

**现实**：不是代码 PR，是架构提案 discussion：
- 论据：shadcn 2026-07 官方默认 Base UI、radix 进入维护态；antd 5 与 React 19 的兼容
  成本；上游仍在 zustand 4 + reactflow 11 的双升级债。
- 附带参考实现指针：本仓 reui 分支（迁移四批次、239→2 选择器、447+154 测试全绿、
  v0.10.0 双包已发）作为「antd → tailwind+shadcn-Base + flow 12 + zustand 5」的
  完整先例。
- 预期：对方大概率不采纳（antd 是他们的产品面），但提案本身为本仓分叉正当性存档。
**成本**：~0.5 天写提案。**风险**：零（discussion 不强求回复）。
**前置裁决提醒**：此前裁决「gorules 上游贡献 intended」以线 A/B 为主兑现；线 C 是
存档动作，不阻塞 v1.0 分叉。

## 3. 本仓后续开发序列（按优先级）

| # | 事项 | 说明 | 状态 |
| --- | --- | --- | --- |
| N1 | **flow 工具条数组值修复** | 批 4 遗留缺陷：flow-1/flow-3 仍走 radix 翻译补丁，`isCanvasTool(array)` 恒 false 工具切换失效；已修（8bfc3ee6） | ✅ done |
| N2 | **editor 仓升级双包 0.10.0** | editor reui 分支从 tag 配对/源码直通切到 npm 0.10.0；核对 asChild→render、data-* 选择器覆盖、delayDuration 三类破坏面 | 待执行 |
| N3 | **v1.0 硬分叉** | 原裁决「发 v1 前完成 Base UI 迁移」的条件已满足；分叉后仓名切换 verdict-weave | 条件成熟，待宿主定日 |
| N4 | **ReUI flow base 变体跟踪** | 等 `/r/base/flow-*.json` 上游发布后重装 base 块；N1 修复后宿主已原生匹配其 API，届时只需换数据源 | 外部依赖，issue #306 已跟踪 |
| N5 | monaco → Shadcn Code Block 评估 | 沿用早前结论：表达力不等价，维持 monaco；Base UI 化不改此结论 | 搁置 |
| N6 | 上游贡献三线执行 | 线 A → 线 B → 线 C，各 ~0.5 天，可穿插 | 待宿主排期 |

## 4. 决策点

1. 三条贡献线的执行顺序与是否都做（推荐 A→B→C；C 可只发 discussion 不追回复）。
2. N2 editor 升级的窗口（涉及另一仓，需与该仓当前分支状态协调）。
3. v1.0 分叉日期（N3）——迁移与双包发版完成后，剩余 blocker 为零。
