# zen-udf 开发计划 W 系列（发布闭环与文档收口）

状态：shipped · W1–W3 完成（2026-09-13）；W4 按宿主指示挂起
宿主裁决：D7 issue 暂不提交——先总结 Python contextvars 同类行为，待宿主手动探索确认后一并提交；D8 全部文档进站（自动侧栏 + 新增落地页 docs/zen-udf.md，docs:build 验证）。
0.2.0 发布：本机无 npm 凭据（ENEEDAUTH）——按仓内管线以 chore(release) 头部提交触发 CI 发布（publish.yaml 自动拾取 packages/* 未发布包）。
上游：V 系列已 shipped（0.2.0 发布就绪；demo-server 已升级消费；上游 issue 草稿就位）

## 现状侦察结论

- `.github/workflows/publish.yaml` 遍历 `packages/*` 发布未发布包——zen-udf 0.2.0 会被自动拾取，无需改管线
- 仓库内 zen-engine 0.54 直连残留已清零（demo-server 已切 zen-udf 源码直通）
- docs 站点（rspress）未收录 zen-udf 任何文档
- V7 验收项「playground Server run 冒烟」未实际执行（demo-server 单测绿但缺端到端）

## 总览

| 期 | 内容 | 状态 |
| --- | --- | --- |
| W1 | demo-server 端到端冒烟探针（补 V7 验收） | ✅ 全绿 6/6（scripts/probes/demo-server-live.mjs） |
| W2 | 0.2.0 发布管线核验（publish.yaml + npm-smoke 扩展） | ✅ pack→安装→执行链路冒烟通过（scripts/probes/zen-udf-npm-smoke.mjs） |
| W3 | docs 站点收录 zen-udf 文档 | ✅ 全部进站 + 落地页 docs/zen-udf.md（docs:build 验证） |
| W4 | 上游 issue 提交（对外动作） | ⏸ 挂起——宿主将手动探索 Python contextvars 同类行为后一并总结提交 |

建议执行序：W1 → W2 → W3；W4 独立（需宿主确认 D7）。

## W1 demo-server 端到端冒烟探针

- 新增 `scripts/probes/demo-server-live.mjs`（沿用 probes 惯例）：后台起服（bun src/main.ts）→
  `GET /healthz`（demo 头断言）→ `POST /v1/validate`（合法图 200 / 缺边界 400）→
  `POST /v1/execute`（GOLD → 0.85 结果断言）→ `POST /v1/execute trace=true`
  （断言 zen 节点轨迹存在 **且** customNode `traceData.udf` 可用）→ 同模型二连调（L1 缓存复用）→ 停服
- 接入 run-probes（与 docs-stack 等探针同注册方式）
- 价值：关闭 V7 验收缺口；后续 zen-engine/zen-udf 升级的端到端哨兵

## W2 0.2.0 发布管线核验

- 核验 publish.yaml 对 source-only 包（files=src/docs、无 build 步骤）的适配：`pnpm publish` 直接发 src——确认无 lerna/catalog 重写副作用
- `scripts/npm-smoke.mjs` 扩展支持 zen-udf：pack tarball → 临时目录安装 → Bun 跑最小脚本（DecisionRuntime + UdfPack + customNode 图执行断言）
- 发布动作本身：宿主打 tag 触发 CI（对外动作，不在 agent 执行范围）
- 验收：smoke 本地绿；publish.yaml 干跑审查通过

## W3 docs 站点收录 zen-udf

- rspress 导航新增 zen-udf 区块：README（入门）→ 多租户设计 → 上下文传播
- 修复跨目录相对链接（docs/design 内文档互链在站点路由下的转义）
- 不收录：开发计划/上游草稿（仓库内文档，不进站）
- 验收：docs:build 绿 + 探针 docs-404 通过

## W4 上游 issue 提交（对外动作）

- 草稿：[docs/upstream/gorules-zen-async-context.md](./gorules-zen-async-context.md)
- 动作：宿主审阅 → agent 以 gh 提交 issue（可附探针代码块）→ 追踪上游响应
- 需宿主确认 D7

## 待宿主确认

- **D7**：上游 issue 是否由本 agent 直接提交 GitHub（推荐：是——草稿已就位，提交后挂链接回文档；替代：宿主手动提交）
- **D8**：docs 站点收录范围（推荐：入门三篇——README/多租户设计/上下文传播；替代：全部文档进站）
