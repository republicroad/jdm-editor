# zen-udf 开发计划 X 系列（部署修复与稳态运营）

状态：plan · 待宿主确认（2 个决策点见文末）
上游：U/V/W 系列已 shipped；0.2.0 已发布 npm（zen-udf 机制仓进入稳态）

## 现状侦察结论

- **V7 回归风险（本系列主项）**：`apps/demo-server/Dockerfile` 仅复制 `apps/demo-server/**` 与根清单——V7 加入的 workspace 依赖 `@republicroad/zen-udf`（源码直通）不在构建上下文，`pnpm install --filter` 会失败；且运行时阶段的 `node_modules` 复制不含 `packages/zen-udf` 的相对路径，符号链接悬空
- contrib 参考域拆分（D3 后续）的条件已成熟（执行规范 §6.1–6.4 已 shipped），是否现在拆待宿主决策
- W4（上游 issue）保持挂起——待宿主完成 Python contextvars 对比探索

## 总览

| 期 | 内容 | 状态 |
| --- | --- | --- |
| X1 | demo-server Docker 链路修复（V7 回归） | 待开发 |
| X2 | contrib 参考域拆分评估与执行 | 决策点 D9 |
| X3 | verdict U10 联调支持（跨仓观察/答疑/补机制） | 持续 |
| X4 | W4 上游 issue（等宿主 contextvars 总结） | 挂起 |
| X5 | 0.3.x 观察名单（enforce 切换 / 上游 PR 跟进 / verdict 反馈回灌） | 持续 |

建议执行序：X1（必修）→ X2（视 D9）→ X3–X5 稳态运营。

## X1 demo-server Docker 链路修复

- `Dockerfile` deps 阶段：install 前增加 `COPY packages/zen-udf packages/zen-udf/`（workspace 依赖进入构建上下文）
- 运行时阶段：保持 `/repo` 相对布局——`COPY --from=deps /repo/packages/zen-udf ./packages/zen-udf` + `COPY --from=deps /repo/apps/demo-server ./apps/demo-server` + 根 package.json/pnpm-workspace.yaml，`WORKDIR /repo` 下以 `pnpm --filter @republicroad/demo-server exec bun src/main.ts` 或直接 `bun apps/demo-server/src/main.ts` 启动（pnpm 符号链接按相对路径落地）
- 若本机 docker 可用：`docker build` 全量验收；否则结构审查 + `bun src/main.ts` 生产模式（NODE_ENV=production）本地冒烟 + demo-server-live 探针
- 验收：容器内 `/healthz` + `/v1/execute` 全链路 200

## X2 contrib 参考域拆分（D9 决策）

- 方案：contrib 八域（http/crypto/roster/custom_list_query/rate_1h/group_distinct_1h/ip_location/debug）迁出为独立私有包 `@republicroad/zen-udf-contrib`（private，不发布）；公开包 zen-udf 移除 `builtin reference` 装载与 §6 风控色彩
- 联动：demo-server 改依赖私有包（或保留参考域内联）；verdict 不受影响（自带业务包）
- 成本：包骨架 + reference.ts 迁移 + demo-server 联动 + 测试搬家（约半天）；收益：公开发布物零业务语义
- **仅宿主确认 D9 后执行**

## X3 verdict U10 联调支持

- verdict 仓按 [verdict-zen-udf-integration.md](./verdict-zen-udf-integration.md) 执行 U10；本仓按需：机制缺口补丁、契约测试扩展、答疑
- 触发：verdict agent 提出机制层需求时

## X4 W4 上游 issue

- 挂起中——等宿主完成 Python `contextvars` 同类行为的手动探索与对比总结，一并提交 gorules/zen

## X5 0.3.x 观察名单

- `resultValidation` 按租户切 `enforce` 的灰度（verdict 生产数据反馈）
- 上游原生传播 PR 进展（若 gorules/zen 接受，验证保留键通道退化为保险）
- verdict 反馈的机制缺口回灌（新端口/校验规则）

## 待宿主确认

- **D9**：contrib 参考域是否现在拆出独立私有包（推荐：**暂不拆**——demo-server 是唯一消费方且公开发布物已含参考域用途说明；待 verdict 上线、出现第二个业务包消费方时再拆）
- **D10**：X1 的 docker build 验收是否本机执行（推荐：是——若本机 docker 可用；否则结构审查 + 本地生产模式冒烟）
