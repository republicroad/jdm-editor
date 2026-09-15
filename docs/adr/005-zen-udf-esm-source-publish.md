# ADR-005：zen-udf 以 TS 源码发布（main = src/index.ts，不编译 dist）

## 状态
accepted（2026-09）

## 背景

zen-udf 包发布到 npm 时需要决定产物形态：
1. 编译成 dist（`.js` + `.d.ts`）——消费者开箱即用但增加构建管线
2. TS 源码直发——消费者需 bundler/tsx/Bun 但零构建步骤

## 备选方案

| 方案 | 优势 | 劣势 |
| --- | --- | --- |
| dist 编译发布（tsc/tsup） | 开箱即用、类型准确 | 增加 build 管线、版本同步复杂度 |
| TS 源码直发 | 零构建、发布即最新、源码即文档 | 消费方需 bundler/tsx/Bun；类型推断依赖 tsconfig |

## 决策

zen-udf 采用 **TS 源码直发**（`main = src/index.ts`，`files = ["src","docs","README.md"]`）。理由：
1. 消费方（playground / demo-server / verdict）全部使用 bundler 或 Bun 直跑 TS
2. 包内无平台相关二进制（zen-engine 原生绑定由 zen-engine 自身分发）
3. 省去 dist 构建管线与版本同步维护

## 后果

- 消费方需支持 TS 导入（当前三个消费方均满足）
- 0.2.0/0.3.0/0.4.0 均以源码发布，无消费者报错
- 如未来需支持纯 Node `require()` 消费方，再补 dist 编译管线
