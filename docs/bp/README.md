# 最佳实践索引

> 本目录收录 jdm-editor 仓库的可复用操作指南——
> 从实战中提取的**可迁移模式**，供跨仓消费者和后续项目直接套用。
> 与 ADR（决策归档）和 Design Doc（架构计划）互补——BP 是**面向未来的操作指南**。

## 索引

| BP | 标题 | 一句话 | 适用面 |
| --- | --- | --- | --- |
| [跨边界上下文传播](./cross-boundary-context-propagation.md) | 隐式上下文不跨原生边界——捕获→嵌入→重建立→剥离 | Node TSFN / WASM / FFI / RPC |
| [哨兵测试模式](./sentinel-test-pattern.md) | 钉死第三方依赖的关键行为，升级先红 | 任何未文档化的外部依赖行为 |
| [契约测试套件](./conformance-test-suite.md) | 端口接口 + 工厂 + 共享断言——所有实现跑同一套测试 | 多实现的策略端口 |
| [语义三元效果隔离](./semantic-triad-effect-isolation.md) | query/observe/act 副作用分级，运行时强制回放与幂等 | 有副作用的插件/回调系统 |
| [缓存所有权模式](./cache-ownership-pattern.md) | 引擎无缓存时宿主自管 LRU+TTL+版本键 | 引擎/框架无缓存但高频决策 |
| [ESM-only 源码发布](./esm-source-publish.md) | TS 源码直发不编译 dist | 内部工具包、消费方可控 |
| [reui 组件本地化模式](./reui-component-pattern.md) | ReUI registry 组件跨仓本地化的接入与演进 | 跨仓共享 shadcn/ReUI 组件 |
| [Monorepo App + 多库](./monorepo-app-and-libraries.md) | 一个 app 消费多个同仓库：源码形态 vs 产物形态不互渗 | 仓内 app + libraries 的 pnpm monorepo |
| [临时跨项目源码直通](./cross-repo-source-bridge.md) | 仓外消费者发版前预览未发布源码：link/portal 桥五步接拆 | 跨仓消费者临时验证（verdict/editor） |
| [zustand 选择器相等性](./zustand-selector-equality.md) | useShallow 只救一层——嵌套派生选择器用深比较 memoizer | zustand v5 订阅与 traditional 迁移 |

## 选用规则

| 你在做什么 | 读哪篇 |
| --- | --- |
| 宿主调原生引擎回调，上下文丢失 | BP-01 跨边界上下文传播 |
| 升级第三方依赖担心行为变化 | BP-02 哨兵测试模式 |
| 定义端口接口有多个实现 | BP-03 契约测试套件 |
| UDF/插件有不同副作用等级 | BP-04 语义三元效果隔离 |
| 引擎不缓存需要自管 L1 | BP-05 缓存所有权模式 |
| 发布 TS 源码包到 npm | BP-06 ESM-only 源码发布 |
| 仓外应用要在发版前看库的未发布改动 | BP-07 临时跨项目源码直通 |
| zustand 订阅触发渲染循环或迁移 traditional | BP-08 zustand 选择器相等性 |

## 格式约定

每篇 BP 包含：适用场景 / 核心模型 / 铁律 / 仓内实例（代码交叉引用）/ 反模式。
