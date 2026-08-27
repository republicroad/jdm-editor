# 故障排查记录 / Troubleshooting Notes

> 中文为同步译文;英文原文见 [`troubleshooting.md`](./troubleshooting.md)。
> 每条记录遵循"现象 → 排查 → 根因 → 修复 → 验证"结构,便于后续维护者复用
> 诊断手法而不只是记住结论。

## 1. 决策表压力测试故事冻结整个测试进程

**日期:** 2026-08 · **修复提交:** `9ba5a82`(+ `06dbe4d` lint 后续)

### 现象

`test-storybook` 在 `decision-table.test.js` 中报 3 个失败,均为
`Exceeded timeout of 15000 ms`:`Stress Test`、`Business Mode`、
`Business Mode Dictionaries`。失败看起来每次随机,最初被归咎于本地机器
性能("CI 上会过")。

### 排查时间线

1. **按 CI 同款条件复现。** 不用 dev server,改为静态构建后由静态服务
   承载(`storybook build -o docs` + `http-server`)再跑套件。结果仍然
   失败,但**只剩 2 个**——且"嫌疑人"变了:`Stress Test` **通过**,
   两个数据量极小的 `Business Mode` 故事反而在新的 120 s 上限下超时。
   套件总耗时 **250 s**。
2. **做时间算术。** `decision-table.test.js` 共 246.5 s 跑完 4 个用例。
   两个顶格超时 = 240 s ⇒ 其余两个(含 10k 行压力渲染)合计只用了约
   6 s。同一 Jest worker 内的用例共享一个浏览器;同源 iframe 共享同一个
   Chromium 渲染进程。若某用例结束后仍持续占用 CPU,会饿死该 worker 中
   之后所有同源用例。
3. **单独直载探针。** 用 Playwright 直接加载每个故事的 `iframe.html`:
   - `business-mode`:约 10 s 渲染完成、13 行、零控制台错误、页面可响应。
   - `stress-test`:探针被彻底冻结——`page.evaluate('1+1')` 在超过
     170 s 后仍未返回;每 5 s 打印一次的轮询循环一行输出都没有,
     说明渲染进程已被完全打满。
   
   反转得到解释:Business Mode 是陪葬的,StressTest 才是投毒者。

### 根因

故事用 `<div style={{height:'100%'}}>` 包裹
`<DecisionTable tableHeight='100%'>`,但 Storybook 的 iframe 不给
`#storybook-root` 任何高度,链条断裂:

```
#storybook-root      height: unset
└─ wrapper div       height: 100% of auto  → auto
   └─ .grl-dt        (无高度)
      └─ container   maxHeight: '100%' 相对 auto 高度父级解析
                     → 百分比失效 → 没有任何约束
```

TanStack Virtual 依据滚动元素 `clientHeight` 计算虚拟窗口。没有约束时,
"窗口"等于全部内容,于是 **10k 行规则全部渲染**(约 10 万个 DOM 节点:
contenteditable 单元格、图标、把手)。持续的布局/绘制工作把渲染进程
主线程无限期打满。

### 修复

- `dt.stories.tsx` —— `StressTest` 改用绝对单位 `tableHeight='90vh'`。
  `vh` 不依赖任何祖先高度即可解析,无论宿主 CSS 如何,虚拟窗口都保持
  有界(约 25 行)。
- `test-runner-jest.config.cjs` —— 将 jest `testTimeout` 提到 120 s,
  为较慢的 CI 机器留防御性余量(runner 会拾取 cwd 下任意
  `test-runner-jest*` 文件并以 `--config` 传给 jest;因包声明
  `"type": "module"` 且 jest 直接加载该文件,务必保持 CJS 格式)。

### 验证

- 修复后单页探针:t=6s 即响应、稳定渲染 25 行、零错误、浏览器正常关闭。
- 完整静态套件:`decision-table.test.js` **246 s → 5.9 s**,总耗时
  **250 s → 9.8 s**,**55/55 全绿**。

### 经验 / 检查清单

- **虚拟化 + 未解析的百分比高度 = 无界渲染。** 任何渲染大数据的故事或
  demo 都必须给滚动容器绝对高度(`px`/`vh`),绝不要依赖 Storybook
  iframe 里的 `100%` 高度链。
- **第 N 个用例超时,元凶可能是第 N-1 个。** 用套件墙钟时间减去各上限
  之和,差值暴露 CPU 饥饿。
- **短超时的 `page.evaluate('1+1')` 是最便宜的忙循环探测器**,专治
  冻结的渲染进程。
- 不要相信*哪个*用例失败——要相信*总共花了多久*。

## 2. 布尔下拉"无法选择":静默不生效

**日期:** 2026-08 · **修复提交:** `d9773f7`(布尔反强转;清除按钮语义另见 `b6f70c0`)

### 现象

表达式构建器的布尔字段里,值下拉能正常打开并显示 `true` / `false` 两项,
但点选 `false` **毫无反应**:触发器仍显示 `true`,表达式预览仍是 `true`,
弹层甚至不关闭。同为字符串值的枚举下拉(状态 `Pending → Cancelled`)走
同一个组件一切正常;问题又恰好在 SCSS→Tailwind 改版后的人工验收中被
发现——起初很像迁移引入的回归。

### 排查时间线

1. **对故障故事做 DOM 探针。** 弹层渲染出 2 个未禁用选项;点击
   `false` 后 `[data-slot="select-content"]` 依然挂载、触发器文本不变。
   Radix *成功*选中时会关闭 popper——说明这次点击根本没被登记为选中。
2. **对照实验。** enum-type 故事经同一个 primitive `Select` 选择正常
   ⇒ 基本链路是通的;问题特定于布尔这种**值类型**。
3. **加仪表的探针。** 先用 `elementFromPoint` 验证选项中心的最顶层元素
   就是选项自身(排除遮挡/z-index 拦截),再用真实鼠标坐标点击,这次
   挂上 `pageerror` 监听:

   ```
   Error: invalid type: string "false", expected a boolean
   ```

### 根因

shim 出来的 primitive `Select` 把 antd 风格的 props 映射到 Radix,而
Radix 只认字符串:无论选项声明的值是什么类型,`onValueChange` 收到的都是
`"false"`。处理器把这个被强转的字符串原样转发:

```tsx
onSelect?.(next, option);
onChange?.(next, option);          // next = 'false' —— 字符串!
```

于是 `BoolInput` 存进了 `{type:'boolean', value:'false'}`——布尔类型字段
里塞了个字符串。下一次序列化时 zen-engine 抛错,更新链条中断:状态不提
交、不重渲染、弹层保持打开。错误只在控制台可见、UI 上毫无提示,所以表现
成"下拉不能选"。字符串值选项掩盖了该 bug(字符串→字符串无损)。这是
**既有缺陷**,与样式迁移无关——只是被人工验收暴露了。

### 修复

`primitives.tsx` —— 按 antd 契约回传匹配选项的原始类型值:

```tsx
const option = list.find((item) => String(item.value) === next)
  ?? ({} as AntdSelectOption);
const raw = option.value ?? next;   // `??` 保住 false;仅未匹配时才回落
onSelect?.(raw, option);
onChange?.(raw, option);
```

改语义前先审计了所有调用点:只有 `BoolInput` 传非字符串选项值;
granularity/枚举下拉均为字符串;`DAYS`/`QUARTERS` 走自定义 chip UI,
不经 `Select`。没有任何消费方依赖收到字符串化后的值。

### 验证

- 修复后探针:点击 `false` 后弹层关闭、触发器显示 `false`、表达式预览
  更新——表达式构建器与标准构建器的布尔故事均如此,零页面错误。
- 全套门禁:typecheck 0 · lint 通过 · vitest 86/86 · 静态套件 55/55。

### 经验 / 检查清单

- **Radix Select 只传输字符串。** 任何 antd 兼容 shim 都必须在调用
  `onChange`/`onSelect` 前通过匹配选项把值"反强转"回来,否则数字和布尔
  选项会悄悄污染下游状态。
- **"能打开但选不上" ⇒ 先看弹层关不关。** 不关闭说明点击没成为选中;
  先挂 `pageerror` 监听,再怀疑 CSS、z-index 或指针事件。
- **类型不匹配会在离输入很远的地方爆炸。** 错误类型的值一路穿过 React
  状态,直到 Rust 序列化器才炸——每个 DOM 探针都应带上
  console/pageerror 捕获。
- **样式迁移后立刻出现功能 bug 时,先跑一个兄弟组件对照。** 一个通过
  的对照(枚举下拉)一步就把问题从"迁移弄坏了 Select"收窄到
  "非字符串值会坏"。

### 后续:全仓 onChange 桥接路径审计(`b6f70c0`)

该经验已沉淀为项目通用规则(同时写入
`.opencode/skills/antd-shim-value-uncoerce/SKILL.md`):**任何 antd 兼容
shim 都必须在调用 `onChange`/`onSelect` 前通过匹配选项把值"反强转"回来,
否则数字和布尔选项会悄悄污染下游状态。** 随后对仓内所有 `onChange`
桥接路径做了完整审计:

| 桥接路径 | 结论 |
| --- | --- |
| Select 单选 `onValueChange` | 有 bug → 上文已修(`d9773f7`) |
| Select 多选/tags → `string[]` | 安全——消费方均按字符串数组设计;`ArrayInput` 自己用 `parseFloat` 反转数字 |
| Select 清除按钮 | 同族 bug → `b6f70c0` 修复(见下) |
| Select `onSelect`,唯一消费者(graph-excel-dialog) | 安全——忽略第一参数只用 option;清除走显式 `onClear` |
| InputNumber | 安全——已正确 `Number()` 反转,空值发 `null` |
| DatePicker / TimePicker | 安全——按 antd 契约发 dayjs 对象 |
| Checkbox / Switch | 安全——纯布尔直传 |
| Radio 组 | 安全——自研 React context 直传原始 `value` prop,不经 Radix |
| Tabs | 安全——tab key 本就是字符串(antd 同设计) |
| Input allowClear | 安全——发 `{target:{value:''}}`,符合 antd Input 事件语义 |

范围封闭:`primitives.tsx` 是 shadcn Select 的唯一导入方,也是仓内唯一的
Radix→antd 值桥接——`components/ui/*` 之外不存在其他 `onValueChange`
桥接。

审计还揪出了同家族的另一个成员:Select **清除按钮发的是 `''`**,而 antd
契约是清除为 `undefined`。这会静默击穿 `dt-excel-dialog.tsx` 里显式的
`val ?? undefined` 防线(`'' ?? undefined` 还是 `''`)。因为所有下游读取
恰好都用真值守卫(`filter(Boolean)`、三元判断),问题一直潜伏未爆发,
但陷阱真实存在——已在 `b6f70c0` 改为发 `undefined`。

## 3. SCSS→Tailwind 迁移后表达式 key 列编辑态高度塌陷

**日期:** 2026-08 · **修复提交:** `d7a89d6`(noStyle 透传 + className 恢复)

### 现象

在 `decision-graph--controlled` 故事中,点击节点的 "Edit Expression"
打开表达式 tab。key 列在只读状态下高度正常(与 expression 列齐平),
但用户点击 key 字段进入编辑态后,textarea 高度塌陷到约原来的一半。
expression 列(CodeMirror)不受影响。

### 排查过程

1. **对比旧 SCSS 与新 Tailwind。** 已删除的 `expression.scss` 在
   `.expression-list-item__key` 下有 `[contenteditable]` 规则,设置了
   `padding: 12px 12px`、`font-size: 13px`、`line-height: 1.5em`、
   `border: 0`、`font-family: var(--mono-font-family)`。A1 迁移提交
   (`c23e136`)误判为死代码并删除。
2. **追踪组件链路。** `expression-item.tsx` 向 `DiffAutosizeTextArea`
   传递 `noStyle`。在 `diff-text-area.tsx` 中,`noStyle` 被解构但在
   非 diff 路径(第42行) **未透传** 给 `AutosizeTextArea`。因此
   `AutosizeTextArea` 始终带 `grl-textarea-input` class,应用了
   `border: 1px solid`、`padding: 4px 11px`、`font-size: 14px`
   ——与旧 SCSS 尺寸不一致。
3. **定位两层问题。** `noStyle` 透传缺失是一层(错误基础样式);
   即使修复透传,裸 `contentEditable` div 没有 padding/高度约束,
   编辑态仍会塌陷。

### 根因

两层叠加:

| 层 | 问题 |
| --- | --- |
| `diff-text-area.tsx:42` | `noStyle` 解构后未透传给 `AutosizeTextArea` → `grl-textarea-input` 始终生效 |
| `expression-item.tsx:117` | 即使 `noStyle` 生效,裸 `contentEditable` 无 padding/高度/字体样式 → 聚焦时塌陷 |

旧 SCSS 的 `[contenteditable]` 规则提供全部尺寸。Tailwind 迁移将其
误判为死代码删除,而 `noStyle` prop 又是坏的,导致替代样式从未生效。

### 修复

**Part 1 — `autosize-text-area.tsx` + `diff-text-area.tsx`**（noStyle
透传,合入 `d7a89d6`）:

- `AutosizeTextAreaProps` 新增 `noStyle?: boolean`。
- `AutosizeTextArea` 条件应用 `grl-textarea-input`:
  `className={clsx(!noStyle && 'grl-textarea-input', className)}`。
- `DiffAutosizeTextArea` 非 diff 路径将 `noStyle` 透传给
  `AutosizeTextArea`。

**Part 2 — `expression-item.tsx`**（className 恢复,同提交）:

```tsx
<DiffAutosizeTextArea
  noStyle
  className='min-h-full py-3 px-3 text-[13px] leading-[1.5em]
             [font-family:var(--mono-font-family)] focus:shadow-none'
  ...
/>
```

以 Tailwind utilities 恢复旧 SCSS 尺寸:

| 旧 SCSS | Tailwind 等效 |
| --- | --- |
| `padding: 12px 12px` | `py-3 px-3` |
| `font-size: 13px` | `text-[13px]` |
| `line-height: 1.5em` | `leading-[1.5em]` |
| `font-family: var(--mono-font-family)` | `[font-family:var(--mono-font-family)]` |
| `&:focus { box-shadow: none }` | `focus:shadow-none` |
| *(填充父容器)* | `min-h-full` |

### 验证

- Storybook `decision-graph--controlled`: 点击 Edit Expression → key 列
  textarea 在只读和编辑态均与 expression 列高度一致。
- 全部门禁: typecheck 0 · lint clean · vitest 92/92 · static suite 55/55。

### 经验 / 检查清单

- **`[contenteditable]` 选择器不是死代码**——即使组件名暗示
  `<textarea>`,`AutosizeTextArea` 实际渲染的是 `<div contentEditable>`,
  匹配 `[contenteditable]`。迁移时需验证实际 DOM 输出再删除 CSS 规则。
- **`noStyle` / `noBorder` 等 opt-out prop 必须在每一层 wrapper 中透传。**
  如果 prop 被解构但未向下传递,"opt-out"会静默失败,消费者仍获得
  默认样式。
- **迁移删除 CSS 规则时,用 DOM 搜索确认选择器不被第三方组件命中。**

## 4. Map Excel Data 面板:行内编辑/删除按钮失效 + 弹窗上下两端溢出视口

**日期:** 2026-08 · **修复位置:** 工作区(`primitives/popover.tsx`、`primitives/popconfirm.tsx`、`primitives/modal.tsx`)· 已登记 **GRL-STYLE-HACK[HK-14]**

### 症状

在 `decision-table--controlled` 导入 Excel 打开"Map Excel data"弹窗后:
每行的**编辑**/**删除**图标按钮点击无任何反应(无弹层、无确认框、控制台零报错);
同时小窗口下面板高于视口——顶部/底部(含底部 OK 按钮)被裁掉不可达。

### 排查时间线

1. **无头复现。** 用 exceljs 在内存构造 xlsx 经 `setInputFiles` 喂入;
   只读 Playwright 探针多视口测量几何与点击结果。
2. **对照实验隔离。** 同一弹窗内行 **Switch** 真实点击可切换、表头区
   **Add Input** 的 Popover 正常打开——Portal 挂载、z-index、Modal 本体
   全部健康。所有失效控件共享一个特征:自定义触发器都是
   `<Tooltip>` 包 `<Button>` 的组合;正常工作的全部是裸 DOM 子元素。
3. **事件流探针。** 捕获监听器证实真实点击把
   `pointerdown → mousedown → click` 完整送达 Edit 按钮,但页面始终
   不出现任何 Radix popper 包装层;直接 DOM `.click()` 也无效——
   处理器接在某处,却什么也不做。
4. **触发器链 DOM 审计。** Button 上只有 `data-slot="tooltip-trigger"`;
   向上全为普通 DIV 后即 `dialog-content`,整条链无任何 popover 属性。
5. **尺寸探针。** 480px 视口高时弹窗计算值 `max-height: 432px` 但实测
   **482px**——恰好等于自身 p-6 padding×2,典型 `content-box` 行为。

### 根因

两个互相独立的迁移期缺陷:

| 缺陷 | 机制 |
| --- | --- |
| 触发器死亡 | Radix `asChild`(Slot) 只把 props/处理器克隆到**直接子元素**。两处按钮都以 `<TooltipTrigger asChild><Button/></Tooltip>` 组合再塞进 `<PopoverTrigger asChild>` / `<AlertDialogTrigger asChild>`。`Tooltip.Root` 是纯 Context 提供者——不渲染 DOM、不转发事件——外层 Slot 克隆的处理器落在了无法接收事件的载体上。 |
| 弹窗溢出 | Radix DialogContent 固定居中且没有高度契约,内容超高时同时溢出上下两端、内部无滚动。此外修复中先加的 `maxHeight` 一度**不生效**:Radix Portal 把节点挂在 `<body>` 直下、位于 `.grl-root` 之外,库的作用域 mini-preflight(`:where(*) { box-sizing: border-box }`)够不到它,shadcn 模板回落到 UA 默认 `content-box`——maxHeight 被自身 padding 吃掉(+48px)。 |

### 修复

- **`primitives/popover.tsx`** —— 子元素无条件包一层真实 DOM:
  `<UiPopoverTrigger asChild><span class="inline-flex">{children}</span></UiPopoverTrigger>`;
  span 承接克隆处理器,内嵌 Tooltip 仍只负责悬停。
- **`primitives/popconfirm.tsx`** —— 对 `AlertDialogTrigger asChild` 做同样包装
  (顺带修复**全库所有** Popconfirm,不止本面板)。
- **`primitives/modal.tsx`** —— 给弹窗立高度契约:`maxHeight: calc(100dvh - 48px)`
  + grid 行 `[auto minmax(0,1fr)_auto]`,body 放进 `min-h-0 overflow-y-auto` 槽位、
  footer 固定在滚动区之外;并显式声明 `boxSizing: 'border-box'`
  (Portal 逃出作用域 preflight 所致)。

### 验证

- 探针矩阵 11/11 PASS:Add Input / 输入行编辑 / 输出行编辑 /
  删除→AlertDialog→Remove 真实删行(4→3);480px 与 380px 视口高下弹窗
  零裁剪(clipT=clipB=0)、body 可滚、OK 键两种高度下均在视口内、约束态
  下 Edit 仍能打开。
- 弹窗外回归冒烟:表头字段胶囊弹层(默认触发路径)正常、
  `codeeditor--lazy-parity` 单击切换+几何对齐保持。
- 门禁:typecheck 0 · lint 通过 · vitest 206/206。

### 经验 / 检查清单

- **`asChild` 要求直接子元素是真实 DOM。** 在 Slot 与 Button 之间夹任何
  纯 Context 组件(Tooltip.Root 等)都会静默吞掉处理器。库 shim 应自行
  保证存在 DOM 元素(F1/F2 正是如此),不要依赖调用方书写方式。
- **Portal 节点活在 `.grl-root` 之外。** 作用域 preflight 通常提供的库样式
  (首当其冲 box-sizing)必须在 portaled 原语里显式重申——或者让 Portal
  挂到带 `.grl-root` 的容器(roadmap §P3 将此系统性解决)。
- **弹窗需要高度契约而不是页面滚动。** 固定居中 overlay 会两端同时裁切;
  应封顶并滚动 body。
- **隔离阶梯省时间:** 默认触发器可用而组合触发器失效→组合问题;
  同一 overlay 内 Switch 可用而 Select/编辑/删除全灭→不是 z-index/
  Portal 级问题。
- **探针自己也会污染状态:** 测试中途按 Escape 会整个关掉 Radix Modal,
  复用陈旧 rect 引用会拿到 `rect(0,0)`——要么重置场景要么重启页面,
  不要沿用旧坐标。

## 5. 本案例引出的缺陷家族跟踪项

另见 `shadcn-theming-roadmap.zh-CN.md` 附录 A:

| 跟进项 | 位置 | 状态 |
| --- | --- | --- |
| 其余依赖隐式 border-box 的 portaled 原语 | `ui/dialog.tsx`、`ui/alert-dialog.tsx`、`ui/popover.tsx`、`ui/select.tsx`、`ui/tooltip.tsx` | 待办——随 roadmap §P1/P3 批量处理 |
| Portal 归属作用域(多岛屿换肤前置) | roadmap §P3 | 计划内 |
