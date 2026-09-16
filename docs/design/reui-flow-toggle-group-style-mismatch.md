# ReUI flow 块风格错配：Base UI 风格块代码 × shadcn radix 系普通名依赖

- 日期: 2026-09-15
- 状态: 待提交上游（ReUI GitHub issue）；本文件为 issue 草稿 + 仓内背景备案
- 发现于: flow-1 试点（见 [reui-flow-pilot.md](./reui-flow-pilot.md)）
- 影响面: flow-1 已复现；flow-2/3/4 同类打包结构，疑似同病

---

## 背景（仓内说明）

playground 以 shadcn CLI 安装 `@reui/flow-1` 试点 ReUI 新推出的 flow 分类。
安装成功、构建成功，但页面白屏——运行时抛
`Uncaught Error: Missing prop 'type' expected on 'ToggleGroup'`。
根因是**风格错配**：块代码按 Base UI 风格书写，而块的普通名依赖从 shadcn
new-york 路径解析出 radix 系组件。以下英文部分为可直接提交 ReUI 的 issue 正文。

---

## [Issue Draft] flow blocks are written against Base UI component APIs, but their plain-name registry dependencies resolve to radix-based shadcn components → runtime crash

### Environment

- Install command: `npx shadcn@latest add @reui/flow-1 --yes --overwrite`
- CLI: `shadcn@latest` (2026-09-15; also reproduces the prompt flow on 4.20.0 per the CLI's own fallback suggestion)
- Consumer `components.json`:

```json
{
  "style": "new-york",
  "registries": {
    "@reui": {
      "url": "https://reui.io/r/{style}/{name}.json",
      "headers": { "Authorization": "Bearer ${REUI_LICENSE_KEY}" }
    }
  }
}
```

- App deps: `radix-ui@^1.6.7`, `@base-ui/react@^1.7.0`, `@xyflow/react@^12.11.3`
- Registry item resolved: `https://reui.io/r/new-york/flow-1.json` (200)

### Reproduction

1. `npx shadcn@latest add @reui/flow-1` in an app configured as above. Install
   and build succeed.
2. Render the block's `Page`.
3. Page renders nothing; console shows:

```
Uncaught Error: Missing prop `type` expected on `ToggleGroup`
```

### Root cause

flow-1's own code is written against the **Base UI** ToggleGroup API
(`src/components/blocks/flow-1/components/canvas-toolbar.tsx`):

```tsx
<ToggleGroup
  multiple={false}                 // Base UI: boolean multi-select flag
  value={[locked ? "hand" : tool]} // Base UI: array value
  onValueChange={(value) => {
    const next = value[0]          // Base UI: handler receives string[]
    ...
  }}
  spacing={0.5}
/>
```

But the block's `registryDependencies` include plain-name entries
(`toggle-group`, `toggle`, `select`, `sheet`, `context-menu`, …). In a
new-york-style consumer these resolve from the **shadcn new-york registry**,
where `toggle-group` is the radix-based implementation
(`ToggleGroupPrimitive.Root` from `radix-ui`) that **requires the `type` prop**
and uses a string `value` / string `onValueChange`.

Result: the composed app mixes one Base UI–flavored block with radix-flavored
primitives, and crashes on first render.

### Attempted mitigations

1. Switch the consumer registry URL to the base path:
   `https://reui.io/r/base/flow-1.json` → **404 not found**. flow-1 does not
   appear to be published under `/r/base/`, so base-style consumers cannot
   install it at all.
2. Local workaround (applied in our copy): translate the one ToggleGroup usage
   to the radix API (`type="single"`, string value/handler). Works, but it is a
   hand-maintained divergence from upstream that must be re-applied on every
   block upgrade, and other Base UI–vs–radix API gaps in the block may surface
   later (only the crashing one is visible at first render).

### Expected behavior

A block published in a registry style should be style-consistent end to end:
either

1. its plain-name dependencies resolve to **Base UI flavored** implementations
   in the consumer's app (e.g. by publishing the block with `@reui/`-prefixed
   or otherwise namespaced base-style deps), or
2. the block is published under `/r/base/flow-1.json` so base-style consumers
   install a coherent set, and/or the new-york variant ships radix-API block
   code.

### Impact

- Any consumer installing flow blocks into a radix/shadcn new-york app hits a
  guaranteed white screen at first render of the block.
- Base UI consumers cannot install flow-1 at all (`/r/base/` 404).
- Presumably affects flow-2/3/4 as well (same block packaging structure); we
  have only reproduced flow-1.

### Notes

- The mismatch is invisible at install/build time (type-level compatible
  enough, runtime only), which makes it expensive to debug — worth a docs note
  or a `postinstall`-style consistency hint in the block README.
- Happy to provide the full reproduction app if useful.
