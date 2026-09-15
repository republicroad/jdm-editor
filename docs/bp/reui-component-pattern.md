# reui 组件本地化模式（跨仓最佳实践）

- 日期: 2026-09-11
- 适用范围: jdm-editor / editor / verdict（所有消费 reui.io 组件的仓）

## 模式：复制式引入 + 适配层

reui.io 组件是"复制源码到项目"型（非 npm 依赖）。接入时：

1. 从 reui registry 或 MCP `get_component` 获取源码
2. 复制到仓内 `components/reui/` 目录
3. **改写导入路径**为仓内约定（`#lib/utils`、`../ui/...` 等）
4. 依赖项（@base-ui/react、cva、clsx、tailwind-merge）按需安装

## 仓内现状

| 仓 | 路径 | 组件 | 寻址 |
|---|---|---|---|
| jdm-editor (appshell) | `src/components/reui/` | alert / autocomplete / badge / cascader | `../../lib/utils` |
| jdm-editor (playground) | `src/components/reui/` | timeline / sortable / tree / code-block | `#lib/utils`（vite alias `#` → src/） |
| verdict (未来) | `apps/dashboard/src/components/reui/` | 按需 | `@/components/reui/...` |

## 两个仓的 components.json 配置

| 字段 | jdm-editor (appshell) | jdm-editor (playground) |
|---|---|---|
| 位置 | 仓根 | packages/playground/ |
| aliases | `#components` / `#lib/utils` | `#components` / `#lib/utils` |
| css | `src/styles/tailwind.css` | `src/styles.css` |
| registry | `@reui`（需 REUI_LICENSE_KEY） | 同左 |

## 密钥管理

- `REUI_LICENSE_KEY` 仅存于各仓 `.env.local`（已 gitignore）
- shadcn CLI **不自动读 .env.local**——执行时需 `REUI_LICENSE_KEY=xxx npx shadcn add ...` 或先 export

## 选型原则

| 场景 | 用 reui | 自己写 |
|---|---|---|
| 通用 UI 展示（列表/详情/状态） | ✅ 选现成组件 | |
| 深度集成仓内 store/编辑器的专用组件 | | ✅ 沿用仓内模式 |
| 需要自定义交互逻辑（拖拽嵌套/虚拟化定制） | 视复杂度 | 简单需求用仓内已有 dnd-kit 即可 |
