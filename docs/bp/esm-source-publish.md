# BP-06：ESM-only 源码发布

## 适用场景

内部工具包发布到 npm，消费方全部为可控环境（Vite/Next/Bun/tsx），不需要支持 CJS `require()`。

## 核心模型

```
package.json
├── type: "module"
├── main: "./src/index.ts"       ← TS 源码直发，不编译 dist
├── files: ["src","docs"]        ← 白名单
└── exports: { ".": { "import": "./src/index.ts" } }
```

## 铁律

1. **`type: "module"`**——包内 `.js` 按 ESM 解析
2. **`files` 白名单**——只发 src + docs + README，不发测试/配置
3. **源码即发布物**——TS 类型推断直接可用，消费方 bundler 原生处理
4. **依赖声明精确**——runtime 依赖放 `dependencies`，peer 依赖放 `peerDependencies` + `peerDependenciesMeta.optional`

## 仓内实例

- `packages/zen-udf/package.json`：`type: "module"` / `main = src/index.ts` / `files = ["src","docs"]`
- 消费方：playground（Vite + workspace:*）、demo-server（Bun + workspace:*）均直跑 TS 源码
- 发布管线：`chore(release)` 头部提交触发 CI `pnpm publish --access public`，发布物冒烟 `pnpm test:zen-udf-smoke`

## 反模式

| 反模式 | 后果 |
| --- | --- |
| 同时发布 CJS + ESM 双格式 | `exports` 条件写错 → 双实例 / 类型断裂 |
| 发布含测试文件 | 消费方 node_modules 膨胀 + 测试依赖泄漏 |
| 忘记声明 peerDependenciesMeta.optional | 未安装可选 peer 的消费方报 peer 警告 |
