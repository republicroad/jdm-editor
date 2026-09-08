# pnpm workspace 链接机制:symlink 直连 vs peer-variant 物理克隆

> 本 monorepo 中 pnpm 如何链接 workspace 包:为什么同一个 kernel 会解析到
> **两个不同的物理位置**,以及保证仓内消费者正确的源码直通策略。
> 起源:[`troubleshooting.zh-CN.md`](./troubleshooting.zh-CN.md) 案例 8 的
> 双副本取证(2026-09-09)。English: [`pnpm-workspace-linking.md`](./pnpm-workspace-linking.md)。

## 一、本仓观测到的两种链接形态

```
packages/playground/node_modules/@republicroad/jdm-editor
    │ symlink → packages/jdm-editor                  (直连,活源码)

packages/appshell/node_modules/@republicroad/jdm-editor
    │ symlink → node_modules/.pnpm/@republicroad+jdm-editor@0._<peer-hash>/
    │           node_modules/@republicroad/jdm-editor
    ▼           (物理克隆,发布形态,安装时刻冻结)
    package.json + dist/ + node_modules/   — 无 src/
```

| | 直连 symlink(playground) | peer-variant 克隆(appshell) |
|---|---|---|
| 内容 | 活源码,改动即时可见 | 上次 `pnpm install` 时刻的冻结快照 |
| 形态 | 源码(含 `src/`) | 发布形态(`dist/` + 元数据 + 嵌套依赖,**无 `src/`**) |
| 何时失效 | —(永远最新) | 每次 `vite build` 重写 dist(见 §三) |

## 二、为什么 pnpm 为 appshell 物化了克隆

kernel 声明了 **peerDependencies**(react、react-dom、monaco-editor)。
peer 的语义是**在消费方上下文解析**——当一个 workspace 包依赖另一个带
peers 的 workspace 包时,pnpm 需要在 `.pnpm/<pkg>@<version>_<peer-hash>/`
创建 **peer-variant 实例**(目录名编码 peer 组合),实例内的包按**发布形态**
物化(应用 publishConfig、无 `src/`),让消费方体验到的依赖与发布后的
npm 产物行为一致,peer 解析确定性有保障。

磁盘实测(2026-09-09):实例内含 `package.json`、`dist/`、嵌套
`node_modules/`(自带依赖解析环境)——**无 `src/`**。

## 三、硬链接冻结循环

1. 物化时克隆文件是 workspace 文件的**硬链接**——同 inode、零拷贝、内容
   一致,一切正常。
2. `vite build` **清空 outDir 并写入全新文件** → workspace 侧出现新
   inode;克隆的目录条目仍指向旧 inode → **克隆永久冻结在安装时刻的
   构建**。
3. `pnpm install` 重物化(重连)——但**下次 build 会再次冻结**。这是
   循环,不是一次性事故。

2026-09-09 实测:workspace `dist/index.js` inode `6755399441228114`
(links=1,Sep 8,含全部修复)vs 实例 `dist/index.js` inode
`844424931592024`(links=4,连 pnpm store,**Sep 4**,缺 `编辑表达式` 及
其后全部修复;md5 不同,731 kB vs 655 kB)。

## 四、为什么重要:测试绿 / 浏览器红

不同消费点解析 kernel 的方式不同:

- **vitest**(appshell 配置)与 **storybook `viteFinal`** 把
  `@republicroad/jdm-editor` 别名到**源码** → 永远最新。
- 经 appshell node_modules 链接解析的路径执行的是**冻结克隆** → 几天前
  的代码(丢失恢复的按钮、被摇掉的 i18n 目录等)。

这正是案例 8 的分歧来源:431 个源码解析的测试全绿,而 storybook 画布跑
的是一周前的代码。证明"实际执行哪版代码"的 fiber 探测手法见案例 8。

## 五、策略

- **仓内所有 workspace 包消费者必须源码别名。** 现有别名点:
  `.storybook/main.ts` `viteFinal`(`@republicroad/jdm-editor` → kernel
  `src/index.ts`)、`packages/appshell/vitest.config.ts`(+ monaco stub)、
  playground vite 配置(两个包)。
- 别名生效后 `.pnpm` 克隆与开发无关;它只在**发布语义**(npm 消费者拿到
  什么)上有意义。
- `pnpm install` 后 appshell 链接会再次物化为克隆——别名在位即无害。
- 若某消费者确需经链接读取最新 dist:构建后重跑 `pnpm install`
  (临时;下次 build 再冻结)。

## 六、取证单行命令

```bash
readlink -f packages/appshell/node_modules/@republicroad/jdm-editor
stat -c 'inode=%i mtime=%y' \
  packages/jdm-editor/dist/index.js \
  node_modules/.pnpm/*/node_modules/@republicroad/jdm-editor/dist/index.js
# 内容探针(i18n 目录金丝雀 + 修复 marker):
grep -c "Upload JSON\|编辑表达式\|default-render-node-marker" \
  packages/jdm-editor/dist/index.js
```
