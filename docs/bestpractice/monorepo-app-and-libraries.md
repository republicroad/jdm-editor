# Monorepo 最佳实践：App + 多个依赖库

> 适用场景：一个应用（app）消费多个同仓库包（libraries）的 pnpm monorepo。
> 本文综合本仓实战（troubleshooting 案例 8、S008、vite 8 升级、单面板测量）
> 与业界模式（Turborepo Internal Packages / Nx buildable libraries /
> @monaco-editor/react 的 loader 模式）整理。相关机制详解见
> [`pnpm-workspace-linking.zh-CN.md`](../pnpm-workspace-linking.zh-CN.md)。

## 一、核心模型：一个库，两种消费形态

同一个库在同一 monorepo 里永远存在两种形态，所有实践都围绕「不混淆两者」展开：

| 形态 | 谁在消费 | 内容 | 验证门禁 |
|---|---|---|---|
| **源码形态** | 仓内 app 的打包器（vite dev/build） | `src/` 源码，改动即时热更 | vitest + storybook |
| **产物形态** | npm 上的外部消费者 | `dist/` 产物 + 类型 + 打包后的 CSS | build + size + consumer-smoke |

**铁律：两种形态的解析路径必须显式声明、互不渗透。** 源码形态走打包器
alias/tsconfigPaths 指向 `src`；产物形态走 package.json `main`/`exports`。
任何一处的隐式回退都会产生「测试绿但应用坏」或「应用对但发布坏」。

## 二、链接策略：源码直通 vs 构建产物

| | 源码直通（Internal Packages 模式） | 构建产物（build-to-dist） |
|---|---|---|
| 做法 | 库的 `exports`/消费方 alias 指向 `src`，app 打包器直接编译源码 | 库先 build 出 `dist`，app import dist |
| 优点 | 零同步问题、跨包 HMR、调试即源码 | 消费方零工具链要求、发布形态=开发形态 |
| 缺点 | 每个消费点需配置直通；对非打包器消费者无效 | 改源码要 build 一次；有产物同步/缓存坑 |
| 适用 | app 的打包器能处理 TS/CSS（Vite/Next 均可） | 库被非打包器消费（Node 直跑、CDN、多构建器） |

**决策规则**：app（打包器根消费者）→ 源码直通；将被发布给外部、或被
非打包器工具消费的库 → 维护 dist 并以此为准。两者可并存：**开发期源码
直通 + 发布期产物**，但必须显式声明切换条件（本仓 kernel 的
`publishConfig` 即此用途）。

**本仓已实施**：三处源码直通别名——storybook `viteFinal`、appshell
vitest、playground vite（均指向两个 workspace 包的 `src/index.ts`）。

## 三、依赖声明：peer 铁律与单例

| 依赖性质 | 声明位置 | 理由 |
|---|---|---|
| 宿主必然存在的框架/全局单例库 | **peerDependencies**（+ devDeps 供自家开发） | 单例铁律：react、monaco、状态库绝不允许两份 |
| 纯函数/无模块态工具 | dependencies | 双份无害（但仍建议 external 减体积） |
| 仅类型使用的包 | devDependencies + 源码 `import type` | 类型契约，运行时零入口 |

**单例铁律**：react（context）、monaco（全局注册表）、zustand（store
实例）等带模块级状态的包一旦出现两份，context 断裂、状态互不可见，症状
是静默的白屏/失效而非报错——极难排查。保证手段：

1. 源码直通 alias 使单例包在仓内只有一个解析结果；
2. 打包器 `optimizeDeps.exclude` 把 workspace 包与单例 peer 排除在预打包
   之外（预打包会冻结副本、制造第二实例——playground 白屏事故的根因）；
3. 发布形态里这些包保持 external（peerDependencies 键展开进
   `external` 列表）。

## 四、pnpm 特有机制：peer-variant 物理克隆与硬链接冻结

pnpm 对「带 peers 的 workspace 包被另一个 workspace 包依赖」**不会**简单
symlink 源码目录，而是创建 **peer-variant 物理实例**（
`.pnpm/<pkg>@<ver>_<peerhash>/node_modules/<pkg>`，发布形态：无 src、
应用 publishConfig），以保证 peer 在消费方上下文确定性解析。

**硬链接冻结循环**（本仓案例 8 实测）：

1. 物化时实例文件是 workspace 文件的硬链接（同 inode、零拷贝）；
2. `vite build` 清空 outDir 重写 dist → 新 inode，硬链接断开；
3. 实例副本**永久冻结在断链时刻的构建**，直到下次 `pnpm install`
   重物化——然后下次 build 再次冻结。

后果：经该链接消费的任何工具（storybook、app）执行的是**几天前的代码**，
而源码解析的 vitest 套件全绿——「测试绿但应用坏」的经典形态。
**对策**：仓内消费点全部源码直通别名（克隆只剩发布语义上的意义）；
禁止让 build 产物成为仓内工具链的解析目标。

## 五、双门禁验证

| 门禁 | 验证形态 | 手段 |
|---|---|---|
| 源码形态 | vitest 全套 + storybook | 行为与渲染正确性 |
| 产物形态 | `pnpm build` + `pnpm size` + consumer-smoke | 真实 npm 安装 + 宿主工具链压缩 + 浏览器渲染 |
| 量化观测 | 单面板测量宿主 | 输出 tree-shaken 负载字节数，为拆分决策提供数据 |

**两条门禁缺一不可**：源码门禁抓行为回归，产物门禁抓发布形态回归
（i18n 目录被摇除、Sass 复合选择器损坏两个案例都只有产物门禁能抓到）。

### 测量宿主（量化依据）

consumer-smoke 增加「仅引 DecisionTable」的宿主变体：构建后统计全部
JS 字节数。本仓实测 2.8 MB（react 19，minified）——单面板负载由共享
内核主导，据此**推迟**子路径拆分（`./dist/table` 等入口），避免无数据
支撑的结构性重构。

## 六、配置清单（checklist）

新建消费 workspace 包的 vite 配置时逐项核对：

- [ ] `resolve.alias`：所有 workspace 包指向 `src/index.ts`（源码直通）
- [ ] `optimizeDeps.exclude`：全部 workspace 包 + 需运行时初始化的包
      （如 `@gorules/zen-engine-wasm`）——否则预打包副本制造双实例/白屏
- [ ] `optimizeDeps` 预打包缓存清理：改 alias/exclude 后删除
      `node_modules/.vite` 再启动
- [ ] 单例包（react/monaco/状态库）不出现在 dependencies 之外的任何
      可捆绑位置
- [ ] tsconfig paths 只用于类型解析的特殊映射需评审（打包器若应用
      paths 到运行时，`.d.ts` 目标会毒化解析——S008）
- [ ] 纯数据模块（i18n 目录）若存在，`sideEffects` 数组声明需验证在
      当前打包器下确实豁免（rolldown 的数组 glob 曾不可靠——本仓已
      回撤，改由「无副作用默认 + 金丝雀门禁」保护）

## 七、本仓现状对照

| 实践 | 状态 |
|---|---|
| workspace 链接策略显式化（源码直通三处别名） | ✅ |
| 单例依赖 peer 契约 + external 策略 | ✅ |
| optimizeDeps.exclude 覆盖 workspace 包 | ✅ |
| **appshell 类型源码直通**（paths 自创建起即指向 kernel `src/index.ts` + ambient 声明 include） | ✅ |
| @types/react 双轨（kernel 19 / appshell 18，多候选 paths 钉住） | ✅（有意设计，服务双 React 宿主支持） |
| 双门禁（源码 vitest/storybook + 产物 consumer-smoke） | ✅ |
| 单面板测量宿主（量化拆分决策） | ✅ |
| size 预算门禁（含 i18n 目录金丝雀） | ✅ |
| 内部包 vs 发布包边界文档化 | ✅（playground private；kernel/appshell 发布） |
| 子路径入口拆分（`./dist/table` 等） | ⏸ 有数据后按需启动 |
| sideEffects 数组声明 | ⏸ 待 rolldown 数组语义可靠后重评 |

### 类型消费的已知脆弱点（有意的权衡，勿"顺手修复"）

- **@types/react 双轨**：kernel 按 React 19 类型（19.2.18）编写，appshell 按
  React 18 类型（18.3.31）typecheck——多候选 paths 有意钉住 18，保证对
  React 18 宿主的兼容性。kernel 采用 React 19 独有类型（`use`、
  ref-as-prop、`React.JSX` 命名空间）时 appshell typecheck 会断，属预期
  信号而非误报；
- **`#*` 子路径导入**（`#icons` 等）依赖 kernel package.json `imports`
  字段解析（moduleResolution: bundler）——appshell 切回
  `moduleResolution: node` 或抽共享 base 时需补 `#*` paths 镜像；
- **appshell 未设 esModuleInterop**（kernel base 为 true）且 `lib` 为
  ES2022：kernel 采用 ES2023+ API 或依赖互操作语义的默认导入类型时，
  appshell typecheck 可能报不兼容——目前未发生，发生时补设置即可。

## 参考

- [`pnpm-workspace-linking.zh-CN.md`](../pnpm-workspace-linking.zh-CN.md)——
  两种链接形态与硬链接冻结的机制详解
- [`troubleshooting.zh-CN.md`](../troubleshooting.zh-CN.md) 案例 8——
  双副本分歧的完整排查记录
- [`roadmap-0.3.0.md`](./roadmap-0.3.0.md) §3.1——代码分割评估与测量数据
- `docs/bundle-analysis.md`——包体组成基线
