# 宿主迁移指南 — `@gorules/jdm-editor` → `@republicroad/jdm-editor`

> 本分支已与上游显著分叉(`ReactFlow 12`、`shadcn/ui + ReUI`、种子派生主题、
> 作用域注入、池化编辑器),不会跟随上游合并。自 `0.1.0` 起以
> `@republicroad/jdm-editor` 发布(1.0 之前,API 可能变化——semver 0.x 约定)。

## 快速切换

```diff
- npm i @gorules/jdm-editor
+ npm i @republicroad/jdm-editor
```

```diff
- import '@gorules/jdm-editor/dist/style.css';
- import { DecisionGraph, JdmConfigProvider } from '@gorules/jdm-editor';
+ import '@republicroad/jdm-editor/dist/style.css';
+ import { DecisionGraph, JdmConfigProvider } from '@republicroad/jdm-editor';
```

## 变更(破坏性)

| 变更 | 影响 | 迁移 |
|---|---|---|
| 作用域注入(P3) | 变量从 `.grl-root` 岛解析,而非 `:root` | 确保应用内容包裹在 `.grl-root` 中(预检本就要求)。若在岛**外**消费 `var(--background)` 等,见下 |
| 语义桥接作用域化 | `var(--background)` 等仅在 `.grl-root` 内解析 | 将消费方内容包进 `.grl-root`,或把桥接变量复制到你自己的 `:root` |
| 池化显示路径(A2) | 懒代码编辑器默认使用只读 EditorView 池 | 退出:`localStorage.gru-hl-view = '0'`(灰度逃生口) |
| `--grl-primary-color(-bg)` 移除 | 与 `--grl-color-primary(-bg)` 重复 | 使用 `--grl-color-primary(-bg)` |

## 新增能力

- **一键换肤**:`<JdmConfigProvider seeds={{ primary: '#7c3aed' }}>` 同时派生明暗两套色板
- **多岛**:一页多个 `.grl-root` 岛,各自独立主题
- **dark 变体隔离**:亮色岛不受宿主页面 dark 作用域影响
- **Seeds Playground**:交互式色板可视化 Storybook story

## `--grl-*` 变量契约

所有 `--grl-*` 变量内联注入到 `.grl-root` 容器。以下为**契约稳定**键
(1.x 生命周期内不变):

全部 `--grl-color-*` 色板 token、`--grl-font-family`、`--grl-line-height`、
`--grl-border-radius`、`--grl-control-outline`、`--node-color-*`。

原先仅面向宿主的键(`--grl-primary-color(-bg)`、`--grl-color-primary-text-hover`、
`--grl-color-info-text`、`--grl-color-bg-mask`)已在 1.0.0 移除——迁移清单见
[`grl-var-flatten.md`](./grl-var-flatten.md)。

## Antd 类型别名

所有 `Antd*` 导出类型(如 `AntdButtonProps`)带指向中性名称
(如 `ButtonProps`)的 `@deprecated` JSDoc。仍然可用,但将在未来大版本移除。

## 0.2.x 新增

### 新公开导出

```ts
import {
  // 请求(输入)节点页签
  TabRequest, type TabRequestProps,
  // request-schema 助手(定义、用例数据源、规范化)
  getRequestDefinitions, getRequestExampleSources, getRequestSchemaSourceValue,
  stringifyRequestSchemaValue, resolveRequestSchemaValue,
  buildRequestSchemaFromDefinitions, buildRequestExampleTemplateFromDefinitions,
  updateRequestSchemaExamples, normalizeRequestDefinitionOrders,
  normalizeRequestFieldKey, normalizeRequestJsonKeys,
  type RequestDefinition, type RequestDefinitionType, type RequestExampleSource,
  // 模拟器自动同步
  useSimulatorAutoSync, AUTO_SYNC_DEBOUNCE_MS, type UseSimulatorAutoSyncParams,
  // 自定义函数界面
  CustomFunctionTable, type TabCustomFunctionProps,
  // JSON Schema 助手
  jsonSchemaToVariableType,
} from '@republicroad/jdm-editor';
```

### `DecisionGraph` 新属性

```tsx
<DecisionGraph
  value={graph}
  // 为用户感知的自定义节点页签解析当前用户
  userResolver={async () => ({ user: currentUser.id })}
  // 自定义节点"函数"表达式模式可用的函数签名
  customFunctions={myFunctionSignatures}
/>
```

- `userResolver`:`() => Promise<{ user?: string } | null>` —— 每次挂载解析一次;
  失败回退为 `''`(控制台告警)。
- `customFunctions`:签名列表,供 `CustomFunctionTable` 的函数模式消费,
  并转发给自定义节点的 `renderTab`。

### 自定义节点开发

`createJdmNode` 规格可提供 `renderTab`,入参为 `{ id, user?, customFunctions? }`;
携带 `content.kind` 的自定义节点,其页签会路由到匹配的 `customNodes` 规格。

### 请求(输入)节点页签

输入节点打开三视图页签:**字段定义 / 用例数据 / Schema**(`TabRequest`)。
节点内容现在为 `{ schema, expressions[], inputField, outputPath }`;
含旧版 `;;` 拼接值的历史图仍可正常加载。

### i18n 增量

0.1 之后新增命名空间:`request.*`、`simulator.*`、`cf.*`,以及既有的
`dt.*`/`dg.*`/`expression.*`/`func.*`。回退链见 [`i18n.zh-CN.md`](./i18n.zh-CN.md),
完整词条见 `theming/messages/en.ts`。

### 0.3.0 预告

- `monaco-editor` 移入 `peerDependencies` —— 宿主需显式安装
  (`npm i monaco-editor`),安装体积减少约 5 MB。
- 草案见 [`roadmap-0.3.0.md`](./roadmap-0.3.0.md)。
