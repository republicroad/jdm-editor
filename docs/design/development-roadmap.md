# 全局开发路线图（2026-09-17）

> 收拢全部在途工作流：规则图 ReUI 优化（当前焦点）、zen-udf 场景节点（P1–P3）、
> 发版积压、跨仓协同（N2/N4）、v1.0 分叉（N3）与清债窗口。
> 各项独立交付；每片一 commit，门禁绿才合入。

## WS1 · 规则图 ReUI 优化（当前焦点）

目标：把 ReUI flow 块的节点卡设计语言落到决策图编辑器。参照物：playground 内的
flow-1/flow-3/flow-2 试点件与 [reui-flow-pilot.md](./reui-flow-pilot.md)。

| # | 切片 | 模式来源 | 状态 |
| --- | --- | --- | --- |
| R1 | 节点卡头部：IconTile（节点色着色）+ 类型 Badge（首次启用闲置的 `type` prop） | flow 块节点卡 | ✅ 0bb311ab |
| R2 | 节点悬浮工具栏：hover/选中显现 设置/复制/复制节点/删除（复用确认对话框） | flow-1 NodeToolbar | ✅ bb2b2753 |
| R3 | 连接线"+"：悬停选节点类型，中点插入并重连 source→新→target（nodeSchema 校验） | flow-1 connector + | ✅ 37deba8c |
| R4 | 分支路径标签：边上显示条件/命名路径（flow-2 named branch paths） | flow-2 | 待开发 |
| R5 | 停靠式检查器：选中带 renderSettings 的节点，画布右上停靠设置面板（useOnSelectionChange + Panel） | flow-2 | ✅ 976f0b6c |
| R6 | 自动布局：dagre 一键整理（flow-2 用 @dagrejs/dagre） | flow-2 | 待开发（依赖评估 dagre 引入 kernel 的体积预算） |
| R7 | 仿真状态条：节点卡底部 run strip（耗时/命中/错误码，对应 simulator trace） | flow-2 last-run strip | 待开发 |

门禁（每片通用）：kernel tsc + 447 测试 + build + size 预算；涉及画布交互的切片加
storybook 交互用例。

上游阻塞：`/r/base/` 注册路径整条 404（2026-09-17 实测，预览页存在但 registry 项未
发布）——flow 块重装待上游发布（并入 N4 跟踪）；当前以本地试点件 + 模式移植规避。

## WS2 · zen-udf 场景节点（P1 → P2 → P3）

详见 [zen-udf-development-plan.md](./zen-udf-development-plan.md) 场景节点路线图节。

- **P1（进行中）**：
  - ✅ 已落地（zen-udf contrib，664e77c8 + 6dcd6577）：`ab.bucket`（FNV-1a 分桶）、
    `geo.distance`/`geo.fence`（Haversine + 射线法围栏）、`validate` 四件（id_card/mobile/
    uscc/bank_card，合成向量测试）
  - ⬜ 待实现：**template**（vendor mustache 子集 + 16KB/64KB 上限）、**datetime**
    （Intl 时区转换 + 营业日/节假日表参数化 + 日期差）、**velocity**（rate-window 泛化）
  - 规格详见对话存档与 host-functions-guide §2.1
- P2：durable 任务（act 类异步副作用；journal 待执行队列投影）。
- P3：LLM 审批流双模式（同内核，节点目录与画布隔离；前置约束 = 引擎无中途暂停，
  两路径决策点已记录）。

## WS3 · 发版积压（✅ 已完成 2026-09-17，22ceb8b8）

已发布并验证：`zen-udf@0.5.0`（notify 域/ToolCallContext/defineToolFor/packChecks/
三形态调用/host-functions-guide）、`jdm-editor@0.11.0`（节点卡 ReUI 头 + R2/R3 +
#reui 本地化）、`jdm-appshell@0.11.0`（notify 目录 + 命名模式开关 + 三形态类型面）。
后续切片随小版本滚动发版。

## WS4 · editor 仓升级（跨仓）

editor reui 分支从 tag 配对/源码直通切到 npm 双包（≥0.11.0）。核对三类破坏面：
asChild → render、data-[state=*] → presence 选择器、delayDuration → delay；
新增：自定义节点面板的命名模式交互。依赖 WS3。

## WS5 · v1.0 硬分叉（N3）

前置 checklist：
- [ ] WS1 切片 R1–R5 完成（R6/R7 可带入分叉后）
- [ ] WS2 P1 全部落地并发版
- [ ] WS3 + WS4 完成（下游已在新版本线上）
- [ ] verdict-weave 仓迁移 + 品牌化 + 断上游（按 verdict-weave-migration-plan）

分叉后即启动：P2 durable 设计展开、flow 块 base 重装（若上游已发布）。

## WS6 · 清债与跟踪

| 项 | 触发/窗口 |
| --- | --- |
| CM phase-2b（删 PARITY 块 + 旧高亮器，烧 ~6 处 !important，下调 style-debt 常量） | v1.0 发布后第一个清债窗口（池化默认态浸泡一周期） |
| N4：ReUI `/r/base/` 发布跟踪（flow 块重装 + 撤翻译层） | 上游发布即触发；当前以本地试点件规避 |
| xyflow handle 样式（5 处 !important） | xyflow 升级窗口 |
| HK-09 Excel wizard | 组件重构窗口 |

## 排序建议

```
✅ WS1(R2,R3,R5) → ✅ WS3 发版 → ⬜ WS2 P1(template,datetime,velocity)
→ ⬜ WS4 editor 升级 → ⬜ v1.0 checklist 清点 → N3 分叉
→ 分叉后: P2 durable 设计 → WS1(R4,R6,R7) → P3 双模式设计
```

依据：发版越早，下游（editor/verdict）集成越早开始消化破坏面；R5（docked
inspector）是 WS1 里工作量最大的一片，放在发版后避免发版内容漂移；P2/P3 均
依赖 P1 稳定，保持远期。
