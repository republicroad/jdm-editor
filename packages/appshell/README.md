# @republicroad/jdm-appshell

`@republicroad/jdm-editor`（内核）的参考消费者层：自定义节点托管、UI 槽位
出现与换肤、持久化契约与认证适配。

## 定位

```
宿主应用 (apps/*)
  ├── @republicroad/jdm-appshell   → 观点性 shell Provider / 自定义节点 / UI kit / 持久化
        └── @republicroad/jdm-editor   → 编辑器内核（peer）
              └── react >= 18 (peer)
```

- **内核**只提供编辑器界面/主题/导入契约，不持有任何宿主观点。
- **appshell** 承载业务侧自定义节点、皮肤系统（按 kind 出现/替换节点 UI，
  配合 `JdmConfigProvider seeds` 一键换肤）与图持久化契约。

## 五大职责域

| 职责域               | 位置                                                   | 内容                                                                                                                   |
| -------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Custom node 宿主** | `components/custom-node/`、`hooks/useCustomNodes.ts`   | 六节点（http-request / query-list / crypto / json-path / template / current-date）+ KeyValueEditor + LockedCornerBadge |
| **Registry 与协议**  | `lib/`                                                 | custom-node-registry（schema→节点，内置兜底）、协议库（http-request / json-path / crypto）、user-resolver、storage-key |
| **组合 Hook**        | `hooks/useCustomNodes.ts`                              | 基础节点 + schema 拉取节点（优雅回退）+ 皮肤覆盖 → `customNodes` 数组                                                  |
| **Skin 皮肤系统**    | `skin/`、`context/theme.provider`                      | `applyNodeOverrides` 按 kind 覆盖 renderTab/renderNode                                                                 |
| **持久化契约**       | `shell/persistence.ts`、`shell/graphs-http-adapter.ts` | `GraphPersistenceAdapter`：宿主实现，乐观锁 + 404 语义 + 版本历史                                                      |

在线文档：https://republicroad.github.io/jdm-editor/docs/

完整说明见仓库文档 [`docs/appshell.md`](../../docs/appshell.md)（在线站点
Docs 区同文）。

## 宿主接线

```tsx
import { DecisionGraph } from '@republicroad/jdm-editor';
import { useCustomNodes } from '@republicroad/jdm-appshell';

// 六个自定义节点开箱即用；schema 拉取失败时自动回退内置定义
const { customNodes, ready } = useCustomNodes();

// 完整壳：用户解析（better-auth 或匿名）+ 持久化适配器由宿主实现
<DecisionGraph customNodes={customNodes} userResolver={...} />
```

## 消费方式

- **monorepo 内部**：源码直连——`main`/`types` 直指 `src/index.ts`，
  vite/bun 直接吃源码；路径别名见根 `tsconfig.json`
  （`@republicroad/jdm-appshell` / `@republicroad/jdm-appshell/*`）。
- **外部（npm）**：`publishConfig` 于发布时切换到 `dist/`
  （`bun run build` 产出 `index.js` + `index.d.ts` + `style.css`）。

## 开发

```bash
pnpm --filter @republicroad/jdm-appshell typecheck   # tsc --noEmit
pnpm --filter @republicroad/jdm-appshell test        # vitest（8 套件 / 67 用例）
pnpm --filter @republicroad/jdm-appshell build       # dist + style.css
pnpm --filter @republicroad/jdm-appshell test:npm-smoke
```

## 运行要求

- React >= 18；`@republicroad/jdm-editor` >= 0.3；monaco-editor 需显式安装
- Tailwind v4 + shadcn 语义 token（`--background`/`--foreground`/... 参考
  `src/main.css`）；内核侧 `--grl-*` 变量由 `JdmConfigProvider` 自动注入

## 发布契约

**dist 是唯一的发布工件**（npm 安装即 `dist/`）；monorepo 内部消费源码直连
（`main/types → src/index.ts`），便于本仓库内的快速迭代与外部仓库的稳定性
隔离。
