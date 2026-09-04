# @republicroad/jdm-appshell

`@republicroad/jdm-editor`（画布内核）的应用外壳层：自定义节点托管、UI 槽位劫持与换肤。

## 定位

```
宿主应用 (apps/*)
  └── @republicroad/jdm-appshell   ← 本包：shell Provider / 自定义节点 / UI kit / 主题桥
        └── @republicroad/jdm-editor   ← 画布内核（peer）
              └── react >= 18 (peer)
```

- **内核**只管画布（决策图/表、模拟器、表达式）；
- **appshell** 负责把业务自定义节点接入画布、按 kind 劫持/替换节点 UI、
  基于 `JdmConfigProvider seeds` 的主题换肤。

## 消费方式

- **monorepo 内部（源码直通）**：`main`/`types` 直指 `src/index.ts`，
  vite/bun 直接消费源码；tsconfig paths 见根 `tsconfig.json`
  （`@republicroad/jdm-appshell` / `@republicroad/jdm-appshell/*`）。
- **外部（npm）**：`publishConfig` 在发布时把入口切到 `dist/`
  （`bun run build` 产出 `index.js` + `index.d.ts` + `style.css`）。

## 宿主要求

- React >= 18；`@republicroad/jdm-editor` >= 0.3（monaco-editor 由宿主安装）
- Tailwind v4 + shadcn 语义 token（`--background`/`--foreground`/... ，参考主仓 `src/main.css`）；
  内核的 `--grl-*` 变量由 `JdmConfigProvider` 自动注入

## 消费契约

**dist 是本包的公共承诺**（npm 安装走 `dist/`）；monorepo 内部走源码直通
（`main/types → src/index.ts`）属于本仓的开发优化，外部仓库请勿依赖。
