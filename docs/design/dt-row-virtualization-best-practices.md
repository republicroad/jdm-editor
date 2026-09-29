# 大表虚拟化最佳实践——调研、选型与实施全程实录

- 日期：2026-09-29
- 状态：已落地（feat `9eb5aa7e`，dt StressTest 万行表窗口化验证通过）
- 适用读者：需要在 `<table>` 语义上做行虚拟化的实现者；接手 vendored grid 维护的人
- 关联：[dt-datagrid-retrofit-plan.md](./dt-datagrid-retrofit-plan.md) 开放问题 1、
  [reui-optimization-backlog.md](./reui-optimization-backlog.md) dt 换装解锁候选

## 1. 问题

dt 核心编辑器换装 ReUI data-grid 后，行渲染走 `DataGridTableDndRows`——它把
`table.getRowModel().rows` 全量 map 成 `<tr>`。万行 StressTest 场景下 DOM 达六位数量级
（行 × 列 × 格内编辑器包装），浏览器捕获曾直接崩溃。换装前的手搓虚拟表没有这个问题，
能力在 Phase 3 清债时随旧实现一起被删掉，而 grid 套件没提供对应物。

## 2. 业界方案对比（选型输入）

| 方案 | 代表 | 适用判定 |
| --- | --- | --- |
| 无头虚拟器 + `<table>` spacer 行 | TanStack Virtual（AG Grid 内核同思路） | ✅ 本仓正解：保住表格语义、a11y、格内编辑器 |
| 内置虚拟化的成品网格 | AG Grid / Handsontable | 功能全但意味着抛弃 vendored grid 双栈并行；体积、样式、学习成本全输 |
| Canvas 渲染 | Google Sheets / Handsontable canvas 层 | 十万行级才值得；编辑器语义与 DOM 生态全要重造 |
| `content-visibility: auto` | CSS 渐进增强 | 只能当补充：与滚动锚定、固定布局测量有已知坑，撑不起主方案 |
| 分页 | — | 不是虚拟化的替代品：`manualPagination` 修复解决「数据可达」，不解决「渲染性能」 |

**结论**：对「DOM 可编辑表格」这一类，无头虚拟器 + spacer 行就是业界最佳实践——它正是
TanStack 官方 virtualization 示例的模式，上游 gorules 也是照此实现。对本仓它还是成本
最低路径：vendored grid 与 TanStack Virtual 同族（v9 Table + Virtual 3.17），且 git
历史里有一份完整参照实现。

## 3. 上游考古（参照实现从哪来）

- 上游 `cfa49c34 "feat: rework table"` 引入手搓虚拟表：`useVirtualizer` 挂滚动容器
  （estimate 38px / overscan 5）→ tbody 里 paddingTop/paddingBottom 两个占位行撑出
  虚拟空间 → 只 map `getVirtualItems()` 渲染窗口行。
- 每行内建 ResizeObserver，把真实高度经 `measureElement` 回报虚拟器；**跳过 0 高测量**
  （tab 隐藏时 `display:none` 报一次 0，缓存它会折叠所有行）——这个细节上游做对了。
- 滚动 API 直接建在虚拟器上：`getVirtualItemForOffset(scrollTop)` +
  `scrollToIndex(index, { align: 'start' })`。
- 拖拽用 dnd-kit 逐行 `useDraggable/useDroppable`，只挂 ref 不改布局，与虚拟窗口天然共存。
- 本仓 Phase 0-3 换装时该实现被整体删除（`d65283e9` 提交说明里的 "manual virtualization
  wiring, ResizeObserver measurement" 即指它），取的是 spike 三选一里的 a（全量渲染）。

考古结论：不需要从零设计——上游模式就是参照实现，工作量在把它移植进 vendored grid 的
行渲染管道。

## 4. 选型决策：虚拟化做在哪

vendored 套件里 `DataGridTableDndRows`（拖拽表体）与 `DataGridTableVirtual`（虚拟表体）
是**两个各自完整的表体渲染器**，各自带 viewport/head/body，互不组合。三条路：

- a. 维持全量渲染——万行回归不解决，否决；
- b. dt 弃 Dnd 保 Virtual——丢行拖拽，否决；
- c. **把虚拟化下沉进 DndRows 表体**（vendored 增强）✅。

选 c 的理由：DndRows 承载的拖拽行为（overlay、传感器、指示条、modifier）一行不动，只改
「哪些行挂载」；行组件 `DataGridTableBodyRow` 早已预留组合插槽——`rowRef`/`dndRef` 双
ref 合成、`dataIndex` → `data-index` 属性、虚拟化感知的条纹奇偶（按绝对行号而非 CSS
nth-child，注释明言「spacer 行随滚动变高会使奇偶翻转」）。

## 5. 实施纪律（在 `<table>` 语义上做虚拟化的七条）

1. **spacer 行撑高，不改网格布局**。窗口外高度 = `items[0].start`（前）与
   `totalSize - last.end`（后），各渲染一个 `aria-hidden` 的占位 `<tr><td colSpan=全部列
   +fill>`。零高时不渲染。
2. **估值 + 实测的混合行高**。`estimateSize` 给初值（dt 沿用 38px），挂载行经
   `measureElement` 实测纠偏。动态行高下 totalSize 随滚动渐进增长，接近底部时需要几次
   滚动迭代收敛——这是该模式的固有行为（滚轮连续滚动平滑收敛），不是 bug。
3. **0 高守卫**。隐藏 tab 报一次 `borderBoxSize.blockSize === 0`，直接缓存会把整表折叠
   到回显。覆写 `measureElement` 选项：遇 0 返回该行上次实测值或估值，不缓存 0。
4. **拖拽源行保活**。dnd-kit 的 active droppable 卸载即断拖。自定义
   `rangeExtractor`：拖拽进行中把被拖行索引强制并入窗口（排序后合并），松手才放行。
   纯函数 `keepDataGridDndIndexInRange` 可单测。
5. **阈值门控（minRows）**。低于阈值走原全量路径——绝大多数决策表与全部快照/交互用例
   的 DOM 逐字节不变，风险面收敛到大表场景。
6. **连接时 0 尺寸兜底**。虚拟器在 commit 时连接，读到 0×0 容器（隐藏 tab、被遮挡的
   webview）后靠 RO 纠正——**而 RO 通知依赖渲染帧投递**。rAF 轮询到容器有真实高度后
   翻转元素 identity 强制重连，重连路径的同步 rect 读取不依赖帧。
7. **滚动 API 建在虚拟器上，且保留小表退化路径**。`scrollApiRef` 双路径：虚拟化时
   `scrollToIndex` + 两帧 rAF 几何精调（补偿 sticky 表头与估值漂移）；小表保持 DOM
   几何查询。顺带修了一个换装遗留回归：`DataGridTableDndRow` 此前不传 `dataIndex`，
   行上没有 `data-index`，调试器定位行的 DOM 查询自 Phase 3 起静默失效。

## 6. 调试过程实录（方法论比结论更值钱）

浏览器验证时遇到「tbody 全空」，jsdom 全绿。排查链：

1. **取证代码版本**：直接 `curl` vite dev server 的 transformed module（`/@fs/...`），
   确认浏览器跑的是新代码（排除 HMR 陈旧）。
2. **排除 HMR 状态污染**：整页 reload 复测——仍空，坐实真 bug。
3. **React fiber 探针**：DOM 节点挂有 `__reactFiber$<random>` 键，沿 fiber 链找到组件，
   遍历 `memoizedState` 钩子链读出虚拟器实例——`scrollElement` 已连接、`count=10000`、
   但 `scrollRect={0,0}`、`items=0`。
4. **对照组实验**：自建 ResizeObserver 观察同一元素——600ms 内 `fires: 0`（规范保证
   新观察目标必有首次回调）⇒ 该 webview 的 RO 通知依赖渲染帧，而帧被饿死。
5. **强制重连判定**：`inst.scrollElement = null; inst._willUpdate()` ——重连路径的
   同步 `getRect(element)` 读取立即得到 648、items=26、DOM 行挂载 ⇒ 连接逻辑健康，
   问题纯在「连接时 0 高 + RO 饿死」。
6. 由此得出第 6 条纪律（rAF 兜底重连），重载后初始窗口自愈，无需任何手工干预。

**jsdom 测试要点**（本仓 vitest 环境）：jsdom 无布局，全部尺寸为 0——
- virtual-core 的 `observeElementRect` 初始读 `getRect = offsetWidth/offsetHeight`；
  `measureElement` 无 entry 回退也读 `offsetHeight` ⇒ stub `HTMLElement.prototype`
  的 `offsetHeight`（TR→38，滚动容器→600）即可让整个链路工作；
- RO 缺失在 virtual-core 全链路有 null 守卫，**不需要** stub ResizeObserver；
- 驱动滚动：jsdom 设 `scrollTop` 不触发事件，手动 `dispatchEvent(new Event('scroll'))`
  ——virtualizer 的 offset handler 直接读 `scrollTop`，无需真实布局。

**教训**：IAB/无头环境可以饿死渲染帧依赖的回调（RO、rAF），验证「帧流」行为时要区分
「代码错」与「环境不投递」——fiber 探针 + 同步路径对照实验是分辨二者的最快手段。

## 7. 验证矩阵

| 层 | 断言 | 结果 |
| --- | --- | --- |
| jsdom（vitest，7 用例） | 大表窗口化（500 行挂载 < 60、窗口连续、spacer 在位）；minRows 以下逐字节全量；事件驱动窗口移动（offset 4000 → 行 105 挂载）；普通行恢复 `data-index`；保活纯函数三态 | ✅ 7/7 |
| 真实浏览器（StressTest 10000 行） | 重载自愈挂载 [0,19]；迭代滚动收敛到末行（窗口 [9987,9999]，`hasLastRow` true）；全程挂载行数 13–34；回顶恢复；拖拽把手在位；截图核对渲染 | ✅ |
| 门禁 | tsc、469 测试、build、size 预算（index.js 校准 770000/190000 → 776000/192000，react-virtual 运行时入包） | ✅ |

## 8. 数字

- DOM 节点：万行 × ~6 列全量 ≈ 十万级 → 窗口态 13–34 行（三个数量级）。
- 体积：react-virtual 运行时入包，checker 口径 +2.1kB，预算按惯例上调（×1.025 校准后
  752→758kB 上限）。
- API 面：`DataGridTableDndRows` 新增 `virtual` / `virtualizerRef` 两个可选 prop，
  不传即关；dt 接入处 `minRows: 100`。

## 9. 可复用检查单

在 `<table>` 语义上做行虚拟化时逐项过：

- [ ] spacer 行撑高而非 div 网格（保语义/a11y/吸顶）
- [ ] `estimateSize` 初值 + `measureElement` 实测，估值偏差可接受（dt 38 vs 实测 ~38.5）
- [ ] `measureElement` 覆写挡 0 高（隐藏 tab）
- [ ] 与 dnd-kit 共存：`rangeExtractor` 保活拖拽源行
- [ ] 小表阈值门控，退路径零变化
- [ ] 连接时 0 尺寸兜底（rAF 轮询 + identity 翻转重连）
- [ ] 滚动 API 走 `scrollToIndex` + sticky 表头精调；小表退化路径保留
- [ ] 行上有稳定的 `data-index`（滚动定位、测试、a11y 都依赖它）
- [ ] jsdom stub：`offsetHeight` 而非 `getBoundingClientRect`（virtual-core 的读取路径）
