# verdict 项目边界与后续开发建议

- 归档日期: 2026-09-11
- 角色: 平台边界备案与接手指引（kernel 会话移交，后续由 verdict 仓独立 agent/团队开发）

## 定位

`verdict` 仓（**私有**）是 SaaS 规则平台：决策模型的登记、版本、鉴权、多租户工作间、
审计与 metrics。依赖方向单向——只消费公开 npm 包
（`@republicroad/jdm-editor`、`@gorules/zen-engine`），与 editor 演示项目无任何依赖关系。

## 边界（硬约束）

1. **不要求 editor 演示项目接入**：editor 是自包含演示栈（本地存储 + 本地执行），
   保持无 verdict 痕迹。verdict 对外提供的 `GraphPersistenceAdapter` 兼容路由层
   服务对象是**第三方/自托管宿主**，不是 editor 演示项目。
2. **编辑器内嵌的正确位置**是 verdict 自己的 dashboard（M5，`apps/dashboard`，
   可嵌 `@republicroad/jdm-editor` 在线编辑），不在 kernel/appshell 中实现任何
   平台逻辑。
3. 公开库仓（jdm-editor）保持 ADR-0001 拓扑：公开库仓发布 npm，私有产品仓消费。

## 移交状态（2026-09-11）

- **M2 done**（verdict 0.2.0，main `282a869`，CI 绿）：
  - better-auth 邮箱+密码（drizzleAdapter 显式 schema：user/session/account/verification）
  - 工作间 + 成员（角色阶梯 owner>admin>editor>viewer；非成员 404 防探测；管理员按邮箱直加+占号）
  - 模型登记：`decision_model` + `decision_model_version`（jsonb content、revision 单调、
    versionName/pinned、baseRevision 乐观锁 → 409 `{error:{code:'CONFLICT'}}`、
    PATCH 部分更新契约 undefined=保留/null=清除）
  - model execute（ZenDecision 按 `modelId:v{rev}` 缓存，zen-rule 模式）+ M1 无状态 execute
  - web 管理面（tanstack-start + tailwind：登录/注册、工作间列表/创建、模型详情）
- **本地基础设施**：postgres 16 经 podman（容器名 `verdict-pg`，端口 5432，
  verdict/verdict/verdict）；迁移已应用（`drizzle/0000_absent_beyonder.sql`）

## 后续开发建议（接手 agent 起点）

1. **M3**：`execution_logs` 审计表 + 落库（model execute 与匿名 execute 均记）+
   分页查询 API；`api_keys` 程序化访问（verdict_ak_ 前缀、sha256 存 hash、
   Bearer 中间件，仅放行 execute 与只读查询）；`GraphPersistenceAdapter` 兼容路由层
   （镜像 graphs-http-adapter 契约：409 CONFLICT / 404 防探测 / auto 保留策略 20 条
   manual-pinned 豁免——**面向第三方/自托管宿主，非 editor 演示项目**）
2. **crypto customHandler**：zen-engine `customHandler` 注册 crypto 语义，
   契约对齐 jdm-editor `lib/crypto-protocol`（兑现「crypto 移至 SaaS 后端」）
3. **M4**：metrics（命中率/耗时/规则热度，基于 execution_logs）
4. **M5**：dashboard（`apps/dashboard`，内嵌 `@republicroad/jdm-editor` 在线编辑）
5. **配置级追加**：邮件邀请流、OAuth provider（better-auth 加 provider 即可）

## 工程注意（实测踩坑记录）

- better-auth `drizzleAdapter` 必须显式传 schema（`{ user, session, account, verification }`），
  否则 insert 静默失败报 `FAILED_TO_CREATE_USER`
- better-auth 生成非格式化 id → **id 列用 `text` 而非 `uuid`**（uuid 列会拒绝写入），
  建议默认值 `$defaultFn(() => crypto.randomUUID())`
- zen 0.54 决策表**规则键匹配列 id**（traceData 形如 `customer.tier[in-tier]`）——
  列 id 与规则键不一致时该规则永不命中（无报错）
- CI：postgres service + `bun run --filter @verdict/db migrate` 步骤；
  `routeTree.gen.ts`（web）需入库，否则新环境 typecheck 失败
- apps/web 直连 api 需 CORS + 凭据（api 端 `hono/cors` credentials:true，
  better-auth `trustedOrigins` 加 web origin）；bun runtime 下 zen-engine 原生绑定稳定，
  Node 24 下 0.54.0 曾出现原生崩溃
