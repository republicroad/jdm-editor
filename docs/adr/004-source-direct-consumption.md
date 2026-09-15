# ADR-004：workspace 包消费方源码直通（不经 dist 副本）

## 状态
accepted（2025-01）

## 背景

pnpm workspace 内的包（jdm-editor / jdm-appshell / zen-udf）被 playground、demo-server 等消费方引用时，如果走 `main = dist/index.js`，会因 pnpm 硬链接副本陈旧导致：
1. 源码改了但消费方仍用旧 dist（双实例：store/context 断裂 → 白屏）
2. kernel dist 变化触发整页 reload（开发体验差）

## 备选方案

| 方案 | 优势 | 劣势 |
| --- | --- | --- |
| 源码直通（resolve.alias 指向 src/index.ts） | 零副本漂移、HMR 即时 | 消费方需 TS/bundler 支持 |
| 每次构建后同步 dist | 消费方无需 bundler | 增加构建步骤、仍可能忘 build |

## 决策

所有 workspace 内消费方一律源码直通——通过 `resolve.alias`（vite）或 tsconfig paths 指向 `src/index.ts`。发布到 npm 的 dist 仅供外部消费者。

## 后果

- 开发体验：改源码秒级热更新
- 副本漂移问题彻底消除
- 发布包 dist 不影响内部消费（内部永不读 dist）
- 对策出处：docs/troubleshooting 案例 8
