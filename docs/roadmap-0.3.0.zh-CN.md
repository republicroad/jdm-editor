# 路线图 — 0.3.0(草案)

> 状态:**草案** —— 范围为提议,未承诺。每一项均列出触发条件;按触发先后发货。

## 1. 已就绪项(代码已就位,随发版生效)

### 1.1 `monaco-editor` → `peerDependencies`

**状态:** 已落在 `reui`(`29366e78`)——随 0.3.0 发版生效。

- 宿主显式安装 `monaco-editor`(`npm i monaco-editor`);安装体积减少约 5 MB。
- 库构建对 `dependencies` **与** `peerDependencies` 一并 external
  (`vite.config.ts` —— 仅 peer 化会静默内联整个 monaco;检测纪律见
  `troubleshooting.md` 案例 #7)。
- 发版说明回归清单:依赖传递 monaco 的宿主需补安装行;
  `consumer-smoke`/`npm-smoke` 已断言新契约。

## 2. 触发门控项(自 0.2.x 规划延续)

### 2.1 池化编辑器灰度开关移除(A2)

- **触发:** 下一个 **major**(无退路的默认行为翻转)。
- 移除 `localStorage.gru-hl-view` 逃生口;池化显示路径成为无条件;
  `cell-view-pool` 保留。

### 2.2 L2 消费者清扫

- **触发:** 下一个 **major**。
- 将剩余内部 `--grl-color-*` 消费点(非桥接键:`bg-container`、
  `primary-hover/bg`、字段 token、chrome 静态)迁移至 shadcn 语义名。
  此后 `--grl-*` 成为纯主题契约。

### 2.3 `--grl-*` 发射废弃

- **触发:** 2.2 完成后 + 一个 minor 的废弃提示期。
- 停止注入仅旧版使用的键;保留 `host-migration-guide.md` §`--grl-*` 记录的
  契约稳定集合。

## 3. 0.2.x 移植引入的新候选

### 3.1 代码分割评估

- index.js 为 713kB raw / 169kB gzip(预算 735k/182k)。构成以决策图 +
  决策表界面与表达式管线为主;monaco 已外置。
- **候选:** 拆分 `DecisionTable` / `DecisionGraph` 入口,只用单一界面的
  宿主不必为另一面付费。需要 exports map 评审(`./dist/table`、
  `./dist/graph`?)与宿主指引;跑一次 `rollup-plugin-visualizer` 后定量。
- **评估结论(2026-09-07,数据落盘 `docs/bundle-stats.json`):**
  `BUILD_ANALYZE=1` 实测 index.js 组成 **100% 为第一方源码**——所有
  dependencies/peerDependencies 均已 external(exceljs、CodeMirror、monaco、
  zen-engine-wasm 都不打进产物)。因此「懒加载重依赖」类手段已无收益;
  宿主实际付费由其打包器的**树摇效果**决定。
  - **已回撤(2026-09-08):** 2026-09-07 加入的两包 `sideEffects` 声明再次
    移除。Vite 8 / Rolldown 下数组 glob 形态(`"**/messages/*.ts"`)没有豁免
    任何模块——Rolldown 把未显式列出的模块一律按无副作用处理,**把整个
    i18n 文案目录摇出了 dist**(key 以 `t()` 参数幸存,全部译文消失;因
    「编辑表达式」按钮渲染为空按钮而暴露)。布尔 `false` 与 glob 数组在该
    Rolldown 版本下都不安全。待验证 Rolldown 对 `package.json#sideEffects`
    数组语义的支持后,并在 size/probe 门禁加上目录快照(`Upload JSON`、
    `编辑表达式`)再重新启用。
  - 下一步(下一周期候选):以 consumer-smoke 增加一个「仅引
    DecisionTable」的树摇测量宿主,量化单面板实际负载;若仍不达标,
    再上 `./dist/table`/`./dist/graph` 子路径入口拆分。
  - **测量宿主已上线(2026-09-09):** consumer-smoke 新增仅引
    DecisionTable 的宿主(react 19),实测树摇后全量 JS **2.8 MB**。子路径
    拆分继续推迟——单面板负载由共享编辑器内核主导。

### 3.2 行拖拽的键盘支持(custom function 表格)

- **状态:部分完成。** KeyboardSensor 已接线(Space/Enter 拾起、Esc 取消、
  放下流程完整),由 `cf-drag-keyboard` 探针守护(6 项断言);并已加入
  `MeasuringStrategy.Always` + `closestCorners` 保证 droppable 测量精度。
- **待办:** 箭头位移的碰撞调优——键盘放下尚不能稳定落在目标行(探针只
  断言生命周期,不断言落点顺序)。大概率需要 `@dnd-kit/sortable` +
  `sortableKeyboardCoordinates` 的可排序布局,而非裸 core droppable;待该
  列表成为一等界面后实施。

### 3.3 模拟器 story 确定性

- 已在 `f5b7c69d` 完成:远程引擎不可达时,story 回退到本地构建的演示
  trace。若抖动复发,升级为 storybook route mock 并彻底移除网络尝试。

## 4. 明确不在 0.3.0 范围内

- 升级 `@gorules/zen-engine-wasm` 到完整图执行引擎——已发布的 wasm 仅含
  表达式层 API(见 T8 调查;远程 `/api/simulate` 仍是执行引擎)。
- Shadow-DOM 作用域注入(Batch S3 归档 —— monaco 阻塞)。
