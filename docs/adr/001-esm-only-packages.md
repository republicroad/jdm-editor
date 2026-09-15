# ADR-001：全部发布包采用 ESM-only（不提供 CJS 双格式）

## 状态
accepted（2025-01）

## 背景

jdm-editor 与 jdm-appshell 均为 React UI 库，消费方全部为现代打包器（vite/webpack5+）或 ESM 运行时。历史上部分宿主仍在 CJS 代码中，需要 `require()` 兼容。

## 备选方案

| 方案 | 优势 | 劣势 |
| --- | --- | --- |
| ESM-only | 产物简洁、tree-shaking 原生、无双格式漂移风险 | CJS 宿主需 `import()` 或迁移 |
| CJS + ESM 双格式 | 兼容所有宿主 | 产物翻倍、`exports` 条件易漏、package.json `main` vs `module` 混淆 |
| UMD | 全兼容 | 体积最大、无 tree-shaking、已过时 |

## 决策

全部发布包采用 ESM-only。`exports` 仅提供 `import` + `types` 条件，不提供 `require`。

## 后果

- CJS 宿主需动态 `import()` 或先迁移模块体系（一次性成本）
- Node 下 `require()` 抛 `ERR_REQUIRE_ESM`（Node 22.12+/23+ 的 `require(esm)` 可同步加载，但依赖消费方运行时版本）
- 打包器原生支持，无额外配置
