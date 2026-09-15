# Storybook 组件高度链条排查指南

## 问题现象

在 Storybook 中，Decision Graph（决策画布）等组件无法全屏展开，画布高度塌缩为组件内容高度，而非填满视口。antd 原版中这些组件是全屏展开的。

## 根因分析

### 高度链条断裂

Storybook 中组件的高度依赖 CSS 百分比从视口逐层传递。链条中任何一个环节没有显式高度，`height: 100%` 就会解析为 `auto`，导致后续所有层级全部塌缩。

```
body               → height: 100vh         ✅ 固定值（如 900px）
#storybook-root    → height: 100%          ✅ 解析为 900px
  div.grl-root     → height: auto          ❌ 断裂！解析为 auto
    story wrapper  → height: 100%          → 解析为 auto（父级无显式高度）
      .grl-dg      → height: 100%          → 塌缩
        flex col   → flex: 1               → 无可用空间
          ReactFlow → position: absolute   → 容器为 auto-sized
```

### 关键文件

| 文件 | 作用 | 问题 |
|---|---|---|
| `.storybook/preview.tsx` | Storybook 装饰器，注入全局 CSS | `.grl-root` div 无高度 |
| `src/styles/tailwind.css` | `.grl-dg` grid 布局 | grid `1fr` 需要父级有可用空间 |
| `src/components/decision-graph/graph/graph.tsx` | ReactFlow 容器 | `position: absolute` 依赖父级显式尺寸 |

### CSS Grid 布局细节

`.grl-dg` 使用 CSS Grid：

```css
.grl-dg {
  height: 100%;
  display: grid;
  grid-template-areas:
    'sidebar graph component'
    'bottom bottom component';
  grid-template-columns: min-content 1fr min-content;
  grid-template-rows: 1fr auto;
}
```

- `1fr` 行需要容器有可用空间才能展开
- `auto` 行仅占据内容高度
- 没有子元素设置 `grid-area`，全靠 auto-placement

### ReactFlow 的特殊性

ReactFlow 内部使用 `position: absolute` + `width/height: 100%`：

```css
.react-flow__container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
```

这意味着 ReactFlow **完全依赖**父容器的显式尺寸。如果父容器是 `auto-sized`，ReactFlow 就没有可用空间。

## 修复方案

在 Storybook 装饰器的 `.grl-root` div 上添加显式高度：

```diff
- <div className='grl-root'>
+ <div className='grl-root' style={{ height: '100%' }}>
```

这确保高度链条完整传递：`body 100vh` → `#storybook-root 100%` → `.grl-root 100%` → story wrapper 100% → `.grl-dg 100%`。

## 排查清单

当 Storybook 中组件无法全屏展开时，按以下顺序检查：

### 1. 检查 Storybook 全局布局

```tsx
// .storybook/preview.tsx
const preview: Preview = {
  parameters: {
    layout: 'fullscreen',  // 必须是 'fullscreen'，否则 Storybook 会加 padding
  },
};
```

### 2. 检查装饰器 CSS 注入

```tsx
decorators: [
  (Story) => (
    <div className='grl-root' style={{ height: '100%' }}>  // 必须有高度
      <style dangerouslySetInnerHTML={{
        __html: `
          body { height: 100vh; }
          #storybook-root { height: 100%; }
        `,
      }} />
      <Story />
    </div>
  ),
],
```

### 3. 检查高度链条每一层

从视口向下追踪，确保每一层都有显式高度：

| 层级 | 必要条件 | 常见问题 |
|---|---|---|
| `body` | `height: 100vh` | 未设置 |
| `#storybook-root` | `height: 100%` | 未设置 |
| 装饰器 wrapper | `height: 100%` | **最常断裂的位置** |
| Story wrapper | `height: 100%` | 未设置 |
| 组件根容器 | `height: 100%` 或固定值 | 使用 `auto` |

### 4. 检查 CSS Grid / Flex 布局

- Grid `1fr` 需要容器有可用空间，否则塌缩
- Flex `flex-1` 同理，需要父级有显式高度
- `position: absolute` 的子元素不参与父级的高度计算

### 5. 检查 ReactFlow 特殊要求

ReactFlow 内部使用 `position: absolute`，完全依赖父容器尺寸。确保：

```css
.react-flow {
  flex: 1;
  height: 100%;
  width: 100%;
}
```

## 预防措施

1. **新组件接入 Storybook 时**，先确认高度链条完整
2. **使用 `position: absolute` 的库**（如 ReactFlow、Monaco Editor），需要额外确保父容器有显式尺寸
3. **CSS Grid 的 `1fr`** 不等于 `100%`，它只分配可用空间——如果没有可用空间，`1fr` 等于 `0`
4. **百分比高度**（`height: 100%`）要求父级有显式高度，否则解析为 `auto`
