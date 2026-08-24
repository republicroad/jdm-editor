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
