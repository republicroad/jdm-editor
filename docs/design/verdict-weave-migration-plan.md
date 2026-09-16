# verdict-weave 迁移计划：v1.0 分叉 → republicroad/verdict-weave

- 日期: 2026-09-16
- 状态: **draft —— 决策背景已定（见 §0）；迁移时点已定（v1.0 分叉时）；执行未启动**
- 新家: https://github.com/republicroad/verdict-weave （已创建；`placeholder` 分支携带说明性空提交）
- 命名定案: 品牌显示名 **Verdict Weave**；仓库名 `verdict-weave`；npm 包名 **β 已定**（§3，分叉后品牌化）

## 追记：rolldown-plugin-dts 试点证伪（2026-09-16）

原计划附带"unplugin-dts → rolldown-plugin-dts"的构建迁移。appshell 试点结果：**构建 OOM，不可用，已回滚**。

- 现象：`vite build` 在 dts 生成阶段堆耗尽崩溃（默认 4GB 与 `--max-old-space-size=8192` 均复现，exit 134）；
- 根因：appshell tsconfig paths 把 `@republicroad/jdm-editor` 解析到内核 src（源码直通的正当配置），
  插件的 tsc 程序随之装载**整个内核类型图**（monaco / codemirror / react 全量）用于 dts 打包，
  内存不可控；插件 0.28.5 **无 external 选项**可把内核声明排除出打包程序；
- 处置：appshell 还原 unplugin-dts 多文件方案（多文件镜像恰是省内存形态），插件依赖已移除；
- 重审触发条件（满足其一再议）：
  1. 插件提供 external/排除语义；
  2. `tsgo` 生成器（TS7 原生）成熟且内存可控；
  3. 内核类型图显著收窄（如 monaco 类型外置）。

## 0. 决策背景（2026-09-16）

1. **jdm-editor 将尝试贡献回 gorules 上游**：当前仓的通用性改进（undo/redo、diff 视图、
   i18n 导出面、theming 引擎、ESM 源码发布模式、键盘 a11y 等）是上游候选；
2. **v1.0 = 正式硬分叉点**：v1.0 之前的状态即"上游贡献候选态"——antd 已清零、
   兼容面中性化、API 冻结评审通过的最佳时刻；
3. **分叉后 verdict-weave 携带 verdict 专属演进**：执行引擎、表达式、UI 三条线都会改，
   上游大概率不接受——这些改动**只落在 verdict-weave**，不污染贡献线。

由此，本次"迁移"实质是**分叉事件**：`jdm-editor` 保留为上游贡献载体，
`verdict-weave` 承接 v1.0 之后的 verdict 主线。

## 1. 时点：v1.0 分叉时（2026-09-16 决策）

1. v1.0 tag 打在 jdm-editor 的分叉提交上（= 上游贡献候选态 + API 冻结宣言）；
2. verdict-weave 于 v1.0 tag 处创建分叉，携带完整历史（fork 惯例，溯源清晰）；
3. **1.0.0 从 verdict-weave 首发**：npm repository/homepage 元数据天然指向新家。

> 早版计划把触发点写作"等 v1.0 之后迁移"，2026-09-16 决策改为 **v1.0 分叉时迁移**
> （分叉即迁移），1.0.0 从新家首发——元数据无需补救步骤。

## 2. 路线：D1 已定 = 分叉（原 §2 的 A/B 之辨收敛）

背景（§0）确立后，早版的"路线 A 原仓改名 / 路线 B 全新 mirror"之辨收敛为：

- **jdm-editor 仓**：不改名、不腾名。作为上游贡献载体保留（尝试捐赠/PR 给 gorules；
  若上游接受部分改进，jdm-editor 继续以通用线存在或逐步归档）；
- **verdict-weave 仓**：v1.0 分叉落点，携带完整历史（mirror push 或 GitHub fork 语义），
  分叉后发布 verdict 品牌包。

分叉 carrying 完整历史是 fork 惯例（溯源与再同步都依赖它），不构成路线瑕疵。

## 3. npm 包名：D2 已定 = β（分叉后品牌化）

分叉后 verdict-weave 发布 **verdict 品牌包**，与上游线明确切割：

| 上游线（jdm-editor，贡献候选） | verdict 线（verdict-weave，分叉后） |
| --- | --- |
| `@republicroad/jdm-editor` | `@verdict-weave/editor`（或 `@verdict-weave/studio-*`） |
| `@republicroad/jdm-appshell` | `@verdict-weave/shell` |
| `@republicroad/zen-udf` | `@verdict-weave/udf` |

- 需创建 npm org `@verdict-weave`（迁移日一次性动作）；
- editor 宿主等存量消费方**不受影响**：它们钉的是上游线 npm 版本；
- 分叉线与上游线若互发修复，cherry-pick 双向搬运（git 同源，可行）。

## 4. 执行清单

### 阶段一：v1.0 前（贡献态收口）

1. `reui` → `main` 改名 redo（editor 已 main + npm 化，无阻塞；三步流程已验证）；
2. 上游候选整理：把"通用性改进清单"从本计划 §0 展开（S 系列已交付项 + 遗留：
   Base UI 之前的通用修复、zen-udf 行为契约、ESM 发布模式）；
3. 向 gorules 发起贡献尝试（PR 或仓库捐赠沟通）——**与分叉并行推进，互不等待**。

### 阶段二：v1.0 分叉（同一天内完成）

4. 三包 1.0.0 齐发（jdm-editor / appshell / zen-udf，API 冻结宣言）；
5. v1.0 tag 打在分叉提交上；由该 tag 创建 verdict-weave 分叉（mirror push 全历史 + tags）；
6. verdict-weave 内包名品牌化（§3 表）+ 首发分叉版本（如 `@verdict-weave/editor 1.0.0`），
   并在其 package.json 写入 repository/homepage/bugs → 新家。

### 阶段三：分叉后（verdict 主线）

7. verdict 专属演进落 verdict-weave：执行引擎、表达式、UI（含 **Base UI 全量迁移**——
   该四批计划整体移至分叉后执行，不再在 jdm-editor 内进行，见
   [base-ui-migration-plan.md](./base-ui-migration-plan.md) 追注）；
8. 上游线的后续通用修复：若上游接受贡献 → PR 到 gorules；若上游观望 → 修复留在
   jdm-editor 并酌情 cherry-pick 到 verdict-weave。

## 5. 分工表：什么去上游，什么进 verdict-weave

| 改动 | 去向 | 依据 |
| --- | --- | --- |
| 图编辑器通用修复（undo/redo、diff、键盘 a11y、i18n） | 上游贡献候选 | 无 verdict 语义 |
| zen-udf 行为契约（语义三元、幂等、审计回放） | 上游候选（engine 之外的运行时规范部分） | 通用决策运行时价值 |
| theming 引擎 | 上游候选（含 antd 派生校准说明——上游最懂这段历史） | 零依赖、通用 |
| 执行引擎修改、表达式扩展 | **仅 verdict-weave** | verdict 语义，上游不接受 |
| UI 定制（Base UI 迁移、皮肤深化、verdict 品牌壳） | **仅 verdict-weave** | verdict 语义 |
| 多租户/名单/频控等业务向 contrib | verdict-weave（或独立私有包） | SaaS 语义 |

## 6. 风险登记

| 风险 | 缓解 |
| --- | --- |
| gorules 拒绝贡献或长期无响应 | 分叉线不受影响（并行推进正是本设计）；jdm-editor 归档或继续通用维护 |
| 双线 cherry-pick 成本 | 分叉点越晚成本越低（v1.0 API 冻结后仅搬运修复）；语义三元等契约测试套件是搬运的回归保险 |
| 分叉后 npm 双包名并存困惑 | 命名切割清晰（§3 表）+ 旧名 deprecate 指路 |
| verdict 专属改动提前混入贡献线 | 上游候选整理（阶段一第 2 步）时以"无 verdict 语义"为唯一准绳 |

## 7. 决策点汇总

- ~~D1 迁移路线~~ **已定**：分叉（verdict-weave 承接 v1.0 后主线，jdm-editor 留作上游贡献载体）；
- ~~D2 npm 包名~~ **已定**：β 品牌化（`@verdict-weave/*`）；
- ~~D3 迁移时点~~ **已定**：v1.0 分叉时；
- **开放项**：gorules 贡献的形式（PR 流 vs 仓库捐赠）与发起时机——不阻塞分叉。
