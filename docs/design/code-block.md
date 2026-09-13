# reui code-block 组件设计文档

- 日期: 2026-09-11
- 状态: 已安装（playground `src/components/reui/code-block/`），**未在任何页面消费**
- 来源: [reui.io](https://reui.io/components/code-block) registry，shadcn CLI 安装
- 底层: [Shiki](https://shiki.style/)（VS Code TextMate 语法引擎）+ 自研 diff/fold/streaming 层

## 定位

面向「终端用户需要**阅读**代码/规则/JSON」的场景提供语法高亮展示。
**不用于编辑**（编辑走 CodeMirror + Lezer，kernel 已有）。

## 当前使用状态

**未被任何页面消费。** 已安装到 playground 并通过 shadcn CLI 落位，但 showcase 页面
暂未集成（reui code-block API 较重，playground 现用 `<pre><code>` + tailwind 已够用）。
后续 verdict dashboard（M5）需要展示规则/表达式/审计日志时在 verdict 仓引入。

## 组件导出面

| 导出 | 用途 |
| --- | --- |
| `CodeBlock` | 根组件：接收 `code` + `language`，内部调 Shiki 高亮并渲染 |
| `CodeBlockContent` | 显式内容容器（与根组件分离，自定义 chrome 时用） |
| `CodeBlockCopyButton` | copy 按钮（读 code，写 clipboard） |
| `CodeBlockDownloadButton` | 下载按钮（导出文件） |
| `CodeBlockExpandButton` | 展开折叠区域 |
| `CodeBlockHeader` | 头部容器（language badge + actions） |
| `CodeBlockLanguage` | 语言徽标 |
| `CodeBlockLineActions` | 行级操作按钮 |
| `CodeBlockTitle` | 标题 |
| `CodeBlockWrapToggle` | 换行开关 |
| `useCodeBlockConfig` / `useCodeBlockFolding` / `useCodeBlockSelection` | hooks |
| `ansiToLines` / `parseUnifiedDiff` | ANSI/Unified Diff 解析器 |
| `CodeBlockProps` 等 12 个类型 | 类型定义 |

## 核心能力

| 能力 | 关键 props |
| --- | --- |
| 语法高亮 | `code` + `language`（Shiki 引擎，100+ 语言） |
| 行号 | `showLineNumbers` |
| 代码折叠 | `foldable` + `foldRegions` / `defaultFolded` |
| 流式渲染 | `streaming`（AI/LLM 逐步输出场景） |
| Diff 视图 | `diff`（Unified Diff 格式）+ 行级 add/remove 着色 |
| 行高亮 | `highlightedLines` / `highlightedWords` |
| 行选择 | `selectable` + `selectedLines` |
| 换行切换 | `wrap`（受控/非受控） |
| 主题 | `themes`（亮/暗双主题自动切换） |
| 复制/下载 | 内建按钮（`CodeBlockCopyButton` / `CodeBlockDownloadButton`） |

## 最小用法

```tsx
import { CodeBlock } from '#components/reui/code-block/code-block';

<CodeBlock code={jsonString} language="json" />
```

根组件接收 `code` 字符串即完成高亮渲染；`children` 仅用于叠加 chrome（copy 按钮等）。

## 依赖链

```
code-block.tsx
  ├── shiki                        （语法高亮引擎，~1MB）
  ├── #components/ui/button        （shadcn button）
  ├── #lib/utils                   （cn）
  └── code-block-highlight.tsx     （ShikiTransformer / token 类型定义）
```

## 设计决策记录

1. **playground 不直接消费**：code-block 体量大（2200 行），playground 定位是轻量演示面，
   `<pre><code>` + tailwind 已满足仿真结果展示。首次集成留给 verdict dashboard。
2. **kernel 不引入**：CodeMirror + Lezer 负责编辑侧高亮（双向分工），code-block 负责
   展示侧高亮。两条高亮链路独立演进。
3. **zen expression 高亮**：Shiki 无内置 zen 语法；短期用 `javascript` 兜底
   （90% token 重合），长期可写自定义 TextMate 语法（50–80 行）注册到 Shiki。
