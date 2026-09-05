# Appshell 规划总纲（宿主协作视角）

> 2026-09-05 由 editor 宿主会话起草（第五十三批）。定位：**appshell 的能力规划、
> 宿主分工边界与协作记录**——与 `docs/appshell.md`（包 API 文档，由内核会话维护）
> 互补不重复。

---

## 1. 定位与归属

- appshell（`@republicroad/jdm-appshell`）于第四十七批从 editor 仓迁入本仓
  （`packages/appshell`）——内核 + 外壳**同仓共发布**（`lerna publish from-package`
  自动识别未发布版本）。
- **分层契约**：
  - 内核/appshell 拥有：画布能力、可复用组件（VersionHistoryPanel 等）、持久化契约
    （GraphPersistenceAdapter）、graph diff 引擎（立项中）
  - 宿主（editor）拥有：存储后端实现（graphs-store 文件存储）、自动保存/保留策略、
    认证、应用级接线
- 判定原则：**下一个宿主也需要的能力 → 本仓；只有当前宿主需要的策略/后端 → 宿主**。

---

## 2. 已落地能力（第五十~五十二批）

| 能力 | 批次 | 说明 |
| --- | --- | --- |
| 快照持久化 | 第五十批 | `content.session = graphRef.serialize()`（viewport/页签/各页签 slice）随图数据同批入库 |
| 版本历史面板 | 第五十批 | `VersionHistoryPanel` 受控组件（宿主喂 versions/currentRevision/onRestore） |
| TabRequest 草稿 slice | 第五十一批 | `request-session-draft.ts`：捕获 700ms 防抖窗口的在途编辑（schema 草稿/示例/描述/页签） |
| 自动保存 + 治理 | 第五十二批 | auto/manual 两层版本；`AUTO_VERSIONS_KEEP=20` 保留策略 |

---

## 3. 规划：IndexedDB 本地适配器（未实现）

### 3.1 动机

服务端多版本存储（graphs-store）难以库化（文件布局/owner 隔离/HTTP 路由均为
editor 特有）。**浏览器本地多版本（IndexedDB）是标准能力**——实现为 appshell 的
本地适配器后，**无后端的宿主也获得完整版本历史能力**（面板/治理全复用）。

### 3.2 设计

```ts
// packages/appshell/src/shell/indexed-db-adapter.ts
export function createIndexedDbAdapter(dbName = 'jdm-appshell-graphs'): GraphPersistenceAdapter;
```

- 存储模型（复刻 graphs-store 语义）：单 object store `graphs`，双键——
  `head::{id}`（meta+content+session）与 `ver::{id}::{revision}`（归档，meta 含 auto）
- 契约实现：list（按 updatedAt）/load（head 或 revision）/save（upsert+归档+
  **保留策略内建：全部 manual + 最近 20 条 auto，超限删最旧 auto**）/delete（head+归档
  全删）/listVersions（updatedAt 排序）
- **语义差异（本地单用户）**：无 owner 隔离、无 CONFLICT（`baseRevision` 忽略——
  单用户无并发写）；注释说明与 HTTP 适配器的差异
- 零新依赖（原生 IndexedDB promise 封装）；测试用 `fake-indexeddb`（devDep）

---

## 4. 规划：恢复即前进 + 命名版本

- **恢复即前进**（业界"restore is forward"）：恢复历史版本后，后续保存创建
  **新版本**（不覆盖其后版本，历史不可破坏）
- **命名版本**：保存时可命名（`versionName` 全链），面板按名显示；命名版本不受
  auto 治理影响

---

## 5. Graph Diff 立项（已出规格）

版本对比能力（P1 面板变更清单 → P2 画布高亮）。规格全文见
[graph-diff-spec.md](./graph-diff-spec.md)（算法选型/API 形态/验收标准）。

---

## 6. playground 提案（未实现）

`packages/playground`：库消费方演示/QA 应用（Vite+React 最小壳：DecisionGraph +
DecisionTable + 模拟器 + VersionHistoryPanel）。价值：内核仓获得**自包含集成验证面**
（pnpm 树内联验证，editor bump gitlink 前即可发现问题）+ 演示/onboarding。
`pnpm-workspace packages/*` 零改动自动纳管。

---

## 7. 宿主分工边界表

| 能力 | 内核/appshell（本仓） | 宿主（editor） |
| --- | --- | --- |
| 画布渲染/diff/序列化 | ✅ | 消费 |
| 持久化契约 + 面板组件 | ✅ | 实现存储后端（graphs-store） |
| 自动保存触发策略 | 契约内建（auto 标记） | 宿主定触发时机/防抖 |
| 保留策略 | 契约内建（AUTO_VERSIONS_KEEP） | 可覆盖 |
| 存储后端 | 本地 IndexedDB 适配器（内建） | HTTP 适配器参考实现（graphs-http-adapter） |
