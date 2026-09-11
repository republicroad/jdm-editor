# editor 项目边界与后续开发建议

- 归档日期: 2026-09-11
- 角色: 演示项目边界备案（原 kernel 会话产出，随 S005 闭案归档）

## 定位

`editor` 仓（公开）是 **jdm-editor 的官方演示项目**，定位为「自包含的编辑器演示栈」：

- 前端：Vite React 应用，消费 `@republicroad/jdm-editor`（workspace/内嵌上游 monorepo）
- 后端：Bun + Hono（apps/editor），**本地文件存储**（graphs-store）+ **本地执行**（apps/zen-rule 封装 zen-engine）
- 契约：`/api/graphs`（GraphPersistenceAdapter HTTP 方言）、`/api/simulate`

## 边界（硬约束）

1. **不依赖 verdict 项目**（私有 SaaS 仓）：不得出现 verdict 的端点、依赖、SDK 或任何 SaaS 业务逻辑。依赖方向单向：

```
editor（演示，公开）──→ jdm-editor（UI 库，公开）
                            ↑
verdict（SaaS，私有）───────┘  （仅经 npm 包，运行时互不依赖）
```

2. **保持自包含演示能力**：clone 后 `bun install && bun run dev` 即得完整编辑器 + 本地执行，无外部服务依赖。
3. **升级只消费公开 npm 包**：`@republicroad/jdm-editor`（semver）、`@gorules/zen-engine`。

## 后续开发建议

1. **升级 jdm-editor ≥0.9.0**（appshell 三期槽位全就绪）：
   - `SkinnedDecisionGraph` 替换 `DecisionGraph`
   - ocean 皮肤注入三期槽位：P1 `layout.toolbar`（工具栏按钮）、P2 `layout.panels.right`（右缘 Sheet 面板）、P3 `layout.header.slots`（头部环境标识/徽标）
2. **0.7.0 breaking 迁移**：停止注册 `json_path` / `template` 自定义节点（zen 表达式已覆盖其能力）；`crypto` 节点保留（zen 无加密能力）
3. **monaco 本地加载**：参照 playground `main.tsx` 的姿势（`loader.config({ monaco })` + 五语言 `?worker` 本地路由），避免 CDN 依赖
4. **模拟器**：`GraphSimulator` 的 `onRun` 接本地 zen-rule 引擎（apps/zen-rule 已具备 `createDecisionWithCacheKey` 执行与 trace 能力）
5. **候选**：kernel roadmap 3.2 键盘拖拽的宿主侧配合（若启用）

## 红线

- 不引入 verdict / 任何 SaaS 平台的端点、依赖或业务语义
- 不在公开仓存放密钥（REUI_LICENSE_KEY 等仅入本地 .env.local，已 gitignore）

## 后续建议状态对照（2026-09-10，editor 会话回写）

| # | 建议 | 状态 |
| --- | --- | --- |
| 1 | 升级 jdm-editor ≥0.9.0 + SkinnedDecisionGraph + 三期槽位 | P1/P3 ✅（editor 第七十一批：切换 + ocean toolbar 注入）；P2 右缘面板 + P3 ShellHeader 接线 → editor 第七十三批收口 |
| 2 | 0.7.0 breaking 迁移（停注册 json_path/template，crypto 保留） | ✅（editor 第七十二批：contrib 移除，与内核终态对齐） |
| 3 | monaco 本地加载 | 宿主现状为**自托管 AMD min/vs**（版本化静态路径），无 CDN 依赖——已满足边界；playground ESM 姿势作为路线③可选演进备案（宿主 docs/18 裁决维持现状） |
| 4 | 模拟器 onRun 接本地 zen-rule | 收口方式调整为 `bun run dev` 单命令全栈（concurrently：dev:api + vite）——「本地执行」定位不变；浏览器 wasm 回退（无 UDF 执行能力）列为可选后续 |
| 5 | 键盘拖拽宿主侧配合 | 待内核 roadmap 3.2 启用 |

红线核查：代码零 verdict 依赖 ✓；.env.local 已 gitignore（REUI_LICENSE_KEY 仅本地）✓。
