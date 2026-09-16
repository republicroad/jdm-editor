# verdict-weave 迁移计划：jdm-editor → republicroad/verdict-weave

- 日期: 2026-09-16
- 状态: **draft —— 触发条件未满足（等 jdm-editor v1.0），仅规划不执行**
- 新家: https://github.com/republicroad/verdict-weave （已创建，公开空占位，无默认分支）
- 命名定案: 品牌显示名 **Verdict Weave**；仓库名 `verdict-weave`（连字符）；npm 包名策略见 §3（D2 待决）

## 1. 触发条件：为什么等 v1.0

1. **v1.0 = API 稳定宣言**：三包（jdm-editor / appshell / zen-udf）公开导出面冻结，
   Base UI 迁移等大动作在 v1.0 前收口——迁移落在 API 最稳定的点上，宿主升级零惊吓；
2. **元数据时机**：npm 的 repository/homepage 元数据只在发布时刷新——v1.0.0 在新仓发布，
   registry 直接指向新家，无需补丁版本修正；
3. **生态清账**：editor 已切 main + 纯 npm 消费（batch 85，0.8.1/0.9.1），submodule 已移除，
   迁移不再有 gitlink 消费方；verdict U10 直接按新坐标接入。

## 2. 迁移路线二选一（决策点 D1）

### 路线 A：原仓改名（推荐）

腾出名字 → 原仓 Settings Rename → 全自动重定向。

- 步骤：占位仓删除或改名让位（刚创建、空、无内容）→ `jdm-editor` Rename 为 `verdict-weave` →
  GitHub 自动：旧 URL（git clone / 网页）**永久重定向**、issues/PRs/star/watcher/secrets/
  Actions/分支保护**全量保留**；
- 成本：几乎为零；失去：无（issues 与历史都在）；
- 与"新仓库"的心理差异仅在于 commit 哈希延续——这恰是资产而非负担。

### 路线 B：全新仓库 mirror

- 步骤：`git push --mirror` 全历史 + 全 tag → 旧仓 Settings **Archive**（read-only）+
  README 顶部指路 → 新仓重建 Actions secrets（NPM_TOKEN / REUI_LICENSE_KEY）、分支保护、
  Pages/部署 → 消费方更新 remote；
- 代价：issues/PRs/star 丢失（或手工导入）、密钥与保护规则重配、外部克隆链接失效靠归档兜底；
- 适用：仅当需要"全新起点"叙事（如彻底切割 GoRules fork 历史出处）。

**推荐 A**：获得与 B 相同的新名字/新定位，零生态损失。占位仓删除不影响任何东西。

## 3. npm 包名策略（决策点 D2）

| 方案 | 包名 | 成本 | 说明 |
| --- | --- | --- | --- |
| α 零迁移 | 保留 `@republicroad/jdm-editor` 等旧名，仅更新 repository 元数据 | 最低 | 包名与品牌名暂不一致（jdm 为 GoRules 格式名遗留） |
| β 品牌彻底 | 新 scope：`@verdict-weave/core` / `shell` / `udf`（需创建 npm org）或 `@republicroad/verdict-weave-*` | 中 | 新名发布 + 旧名 `npm deprecate -m "renamed to …"` 指路；旧版本永久可用 |

- 推荐：**v1.x 走 α，v2.0 时再上 β**——把品牌迁移与破坏性大版本对齐，消费者一次升级完成两件事；
- kernel 是 TS 源码直发包（无构建产物），改名只涉及 `name` 字段与消费方 import spec，无 dist 产物路径问题。

## 4. 执行清单（按路线 A 展开）

### 阶段一：v1.0 前（reui/main 上收口）

1. `reui` → `main` 改名 redo（三步已验证：默认切 reui → 删陈旧 main → rename；
   editor 已 main + npm 化，无消费方阻塞；陈旧 main 指针原样恢复即可）；
2. 待办收敛：Base UI 迁移拍板（可选，不阻塞 v1.0）、ReUI style-mismatch issue 提交上游；
3. v1.0 API 冻结评审：三包导出面 grep 审计（V 系列 exports 审计口径）。

### 阶段二：v1.0 发布

4. 三包 1.0.0 齐发（semver 宣言：1.0 起破坏性变更走 2.0）。

### 阶段三：迁移日（v1.0 发布后择日）

5. 占位仓让名：删除 `verdict-weave` 空仓（或改名 `verdict-weave-placeholder` 留档）；
6. `jdm-editor` Rename → `verdict-weave`；验证旧 URL 重定向（clone + 网页各一次）；
7. 全仓 grep 操作性引用 `github.com/republicroad/jdm-editor`：
   各 `package.json` 的 repository/homepage/bugs、README badge、docs 链接 → 批量更新；
8. 发布 **1.0.1**（patch）：npm registry 元数据指向新家；
9. 验证：新名下 CI（validate/publish）全绿、`pnpm test:npm-smoke`、playground / editor 消费冒烟。

### 阶段四：收尾

10. 旧重定向长期有效（GitHub 不回收）；对外公告 + boundary/docs 里的仓库坐标更新；
11. `docs/archive` 追加迁移备案（本文件补执行记录）。

## 5. 路线 B 追加清单（若 D1 选 B）

- mirror：`git push --mirror`（全历史 + 全 tag；含 reui-archive-20260916 / example-submodule-source-direct 见证 tag）；
- 新仓重建：Actions secrets、分支保护（main 保护规则照抄）、Pages 绑定、代码扫描；
- 旧仓 Archive + README 指路；消费方（editor / verdict / 协作者克隆）更新 remote；
- npm 元数据同阶段三第 8 步。

## 6. 风险登记

| 风险 | 缓解 |
| --- | --- |
| npm 元数据不随仓库迁移刷新 | 迁移日必发 1.0.1（已入清单第 8 步） |
| 路线 B 丢 issues/secrets | 推荐 A；选 B 则走本清单 §5 重建项 |
| 占位仓未让名导致 rename 422 | 清单第 5 步前置处理（本计划撰写时已确认占位仓为空） |
| 迁移窗口内有人向旧名推送 | 迁移日公告冻结窗口；rename 后旧名重定向会落到新名，推送亦跟随 |
| 编辑器/文档站域名未定 | 域名决策独立跟进（verdictweave.dev 等），不阻塞仓库迁移 |

## 7. 决策点汇总

- **D1** 迁移路线：A 原仓改名（推荐）／ B 全新 mirror；
- **D2** npm 包名：α 保留旧名（推荐 v1.x）／ β 新 scope 品牌化（v2.0）；
- **D3** 触发时点：v1.0.0 发布当日 vs v1.0 后首个稳定补丁（推荐后者——多观察一个补丁周期）。
