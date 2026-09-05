# `@republicroad/jdm-appshell` — 参考消费者壳

> 包:`@republicroad/jdm-appshell`(0.1.0)· Peer 依赖:
> `@republicroad/jdm-editor >= 0.3.0`、`react >= 18`、`react-dom >= 18` ·
> 导出:`.` 与 `./dist/style.css`

## 定位

本包是**方案 D 的参考消费者**——kernel/shell 拆分的实化形态。内核
(`@republicroad/jdm-editor`)保持宿主无感知:只提供编辑器界面、主题系统与
导入契约(architecture §8.1),不对"有哪些自定义节点、用户如何认证、图存到
哪里"表达任何观点。所有这类**观点性能力**都在壳(appshell)里。

依赖方向严格单向:**shell → kernel**(peer)。内核绝不反向导入壳;壳自带
UI 套件副本(`components/ui/*`、`reui/*`),不回触内核的 UI 层。

## 五大职责域

| 职责域 | 位置 | 内容 |
| --- | --- | --- |
| **Custom node 宿主** | `components/custom-node/`、`hooks/useCustomNodes.ts` | 六个节点——HTTP request、query list、crypto、JSON path、template、current date——每个含页签渲染器(`*Node` 规格 + `*Tab` 组件),另有 `KeyValueEditor` 与 `LockedCornerBadge` |
| **Registry 与协议** | `lib/` | `custom-node-registry`(schema→节点转换,含内置兜底)、`custom-node-plans`、协议库(http-request / json-path / crypto)、`user-resolver`(better-auth + anonymous 双适配)、`storage-key` |
| **节点组合 Hook** | `hooks/useCustomNodes.ts` | 组合基础节点 + schema 拉取节点(优雅回退)+ 皮肤覆盖,产出 `DecisionGraph` 消费的 `customNodes` 数组 |
| **Skin 皮肤系统** | `skin/`、`context/theme.provider` | `applyNodeOverrides` —— 按 kind 覆盖 renderTab/renderNode;主题种子经 `ThemeProvider` 流入节点 UI 槽位 |
| **Shell 持久化契约** | `shell/persistence.ts`、`shell/graphs-http-adapter.ts` | `GraphPersistenceAdapter` —— 宿主实现:`list`/`load`/`save`(`baseRevision` 乐观锁 → CONFLICT)/`delete`/`listVersions`;404 语义(null/false,绝不抛错);`graphs-http-adapter` 为 HTTP 参考实现;`default-simulate` 接线远程引擎 |
| **UI 套件副本** | `components/ui/`、`reui/` | shadcn 原语 + ReUI 组件(含 cascader 套件)独立副本,保证壳不反向依赖内核 UI 层 |
| **版本历史** | `components/version-history/` | `VersionHistoryPanel` —— 经 `listVersions` 列出/恢复历史版本 |

## kernel / shell 边界规则

1. 内核绝不导入壳(强制方向:壳对内核 peer 依赖 `>= 0.3.0`)。
2. 内核内部导入使用 node subpath imports(`#…`);宿主按设计无法解析——
   宿主需要的一切必须出自内核 `exports`。
3. 壳侧关注点(自定义节点、认证/用户、持久化、皮肤)放在这里,不进内核。
4. 壳界面的 UI 文案(`cf.*` 词条)目前随内核目录发货——已知权衡(壳本就
   依赖内核);若壳未来独立发货再重审。

## 宿主接线

```tsx
import { DecisionGraph } from '@republicroad/jdm-editor';
import {
  HttpRequestTab, httpRequestNode,
  QueryListTab, queryListNode,
  CryptoTab, cryptoNode,
  JsonPathTab, jsonPathNode,
  TemplateTab, templateNode,
  CurrentDateTab, currentDateNode,
} from '@republicroad/jdm-appshell';

// 方式 A —— 显式节点列表:
<DecisionGraph customNodes={[httpRequestNode, queryListNode, cryptoNode, jsonPathNode, templateNode, currentDateNode]} />

// 方式 B —— 组合 Hook(schema 感知、皮肤感知):
import { useCustomNodes } from '@republicroad/jdm-appshell';
const { customNodes, ready } = useCustomNodes({ schemaSource: '/api/custom-nodes/schema' });
// ready ? <DecisionGraph customNodes={customNodes} … /> : <spinner/>
```

接上用户解析与持久化(完整壳):

```tsx
import { createUserResolver, createBetterAuthAdapter } from '@republicroad/jdm-appshell';

<DecisionGraph
  customNodes={customNodes}
  userResolver={createUserResolver(createBetterAuthAdapter())}
/>
```

持久化契约(`GraphPersistenceAdapter`)由宿主实现(REST、数据库、文件系统
均可——HTTP 参考实现见 `shell/graphs-http-adapter.ts`)。

## 集成 story

`src/integration/decision-graph-appshell.stories.tsx` 同时挂载内核
`DecisionGraph`、`useCustomNodes` 与内存版持久化适配器——已发布到在线
storybook 的 **Integration/Kernel + Appshell** 下。

## 开发

```bash
pnpm --filter @republicroad/jdm-appshell typecheck   # tsc --noEmit
pnpm --filter @republicroad/jdm-appshell test        # vitest(node 环境,8 套件 / 67 用例)
pnpm --filter @republicroad/jdm-appshell build       # dist + style.css
pnpm --filter @republicroad/jdm-appshell test:npm-smoke
```
