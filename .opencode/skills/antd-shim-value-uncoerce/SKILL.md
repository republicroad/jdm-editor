---
name: antd-shim-value-uncoerce
description: 排查组件值解析/选中不生效错误时优先检查 antd 兼容 shim 的字符串强转问题。Use when a component's value fails to parse or commit (值解析出错、下拉选不上、选择后状态不更新), or when wiring/maintaining the antd-compatible Select/InputNumber/DatePicker shims over Radix primitives in this repo (primitives.tsx), or on zen-engine serializer errors like 'invalid type: string "x", expected ...'. Radix only transmits strings; every shim must un-coerce via the matched option before onChange/onSelect.
---

# antd 兼容 shim 的值反强转(优先排查项)

## 核心规则

任何把 antd 风格 props 映射到 Radix(`@radix-ui/*`)的 shim 组件,
**必须在调用 `onChange`/`onSelect` 前通过匹配选项把值"反强转"回原始类型**。
Radix Select 只传输字符串:`onValueChange` 收到的永远是 `"false"`、`"5"`、
`"2026-01-01"` 这样的 string。原样转发会污染下游状态——布尔和数字选项
首当其冲。

## 触发条件:值解析出错时,此问题列为第一嫌疑

一旦出现以下任一症状,**先查本问题再查其他**(样式、z-index、事件绑定都排后面):

1. **选择不生效**:下拉能打开、选项可见,点击后触发器显示不变、
   受控值不更新。
2. **弹层不关闭**:Radix 成功选中时会自动关闭 popper;点了却不开 =
   点击根本没被登记为选中。
3. **序列化器报错但 UI 无提示**:控制台/pageerror 出现
   `Error: invalid type: string "x", expected a boolean|number`(zen-engine /
   serde 类错误)。错误类型的值穿过 React 状态,在离输入很远的序列化层爆炸。
4. **数字字段存成了字符串**(或反之),提交的数据类型不对。

## 正确写法(primitives.tsx 已按此修复,commit `d9773f7`)

```tsx
onValueChange={(next) => {
  if (allowClear && next === current) return;
  const option = list.find((item) => String(item.value) === next)
    ?? ({} as AntdSelectOption);
  const raw = option.value ?? next;   // ?? 保住 false/0;仅未匹配时才回落到字符串
  onSelect?.(raw, option);
  onChange?.(raw, option);
}}
```

要点:

- 用 `String(item.value) === next` 反查选项,再取 `option.value` 回传原始类型。
- 必须用 `??` 而不是 `||`:要保住 `false`、`0` 这类假值。
- antd 契约就是如此:`onChange(value, option)` 收到的是选项原始类型的 value。

## 诊断手法(复现自 troubleshooting 案例 2)

1. DOM 探针确认弹层是否关闭——不关闭说明 `onValueChange` 没触发或更新链中断。
2. 跑一个**兄弟组件对照**(如枚举/字符串值下拉):对照通过 ⇒ 问题收窄到
   "非字符串值",一步排除"整个组件坏了"。
3. 挂 `pageerror` + console 监听后再点击——本类 bug 的直接证据是
   `invalid type: string ... expected ...` 序列化错误,UI 上完全静默。
4. Playwright 探针路径:`require('<repo>/node_modules/playwright')`,
   对准 storybook iframe.html 直载故事页探测。

## 改动 shim 值语义前的审计清单

- [ ] grep 所有调用点,找出传入**非字符串 option.value** 的消费者
      (boolean、number 类型)。
- [ ] 确认没有任何消费方依赖收到字符串化后的值(改语义前)。
- [ ] `onSelect` 与 `onChange` 同步修改,签名保持原始类型联合。
- [ ] 清除按钮等旁路路径(`onChange?.('' ...)`)与主路径类型一致。
- [ ] 修完后跑全套门禁:typecheck · lint · vitest · test-storybook 静态套件。

## 参考案例

- `docs/troubleshooting.md` 案例 2「Boolean dropdown silently refuses to
  change value」(中文版同步):完整现象→排查→根因→修复→验证。
- 修复 commit `d9773f7`(布尔反强转)、`b6f70c0`(清除按钮语义)。
