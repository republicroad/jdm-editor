# 迁移 02 —— UI 技术栈:antd 5 → Tailwind CSS + shadcn/ui + ReUI

> 状态:**已完成** —— antd 已彻底移除(分阶段提交见 git 历史)。英文原版:[`02-ui-stack-shadcn-reui.md`](./02-ui-stack-shadcn-reui.md)。
> 完成后的回归问题与修复记录见 [`03-post-migration-fixes.zh-CN.md`](./03-post-migration-fixes.zh-CN.md)。
> 这是展示层的分阶段重写。逻辑层(store、WASM 层、语法包)不动。

## 已确认决策

| 主题 | 决策 |
|---|---|
| 动机 | 内部长期维护分叉;接受与上游永久分叉 |
| Toast / Dialog | ReUI 模式 —— `sonner` toaster + shadcn/ReUI dialog 与 alert-dialog |
| 图标 | ReUI Icons 优先(`REUI_LICENSE_KEY`,Ultimate),统一经 `src/components/ui/icons.tsx` 出口层;lucide-react 兜底;业务代码禁止直接 import 图标库 |
| 样式 | Tailwind CSS v4 编译进 `dist/style.css`,启用 **prefix**、**关闭 preflight**(对库分发安全) |
| 主题 | 重写 `JdmConfigProvider` 输出 shadcn 风格 token;过渡期保留 `--grl-*` 别名桥接 |
| 分发 | 维持编译型 npm 包模式(非源码 registry);Tailwind 产物打包进 `dist/style.css` |

## 现状指标(基线 `283bb11` 实测)

- **58 个文件**引用 antd,约 30 种组件。用量前列:Typography ×31、Button ×28、Tooltip ×13、
  theme token ×13、Select ×10、Dropdown ×7、message ×7,Input/Checkbox/Space/Spin ×6,
  Form/Modal/Tabs/App ×4,Popconfirm ×3;另有 DatePicker/Card/Switch/Radio/Popover/Steps/Tag/
  Avatar/InputNumber/TimePicker/notification/ConfigProvider。
- `@ant-design/icons` 分布于 **27 个文件**(lucide-react 已在 11 个文件并存)。
- 10 个 SCSS 文件只消费 `--grl-*` 变量(主题层早已完成 token 解耦)。

## 阶段计划

### Stage A —— 基建

1. 安装 Tailwind v4(`@tailwindcss/vite`),构建配置:
   - 所有工具类加 `prefix: 'grl-'`,`preflight: false`;
   - 扫描范围限定 `src/**`;产物并入 `dist/style.css`。
2. Token 桥接:扩展 `theme.tsx`,将单一内部调色板同时映射为
   - shadcn 变量(`--background`、`--foreground`、`--primary`、`--border`、`--radius` 等),以及
   - 旧 `--grl-*` 别名(现有 SCSS 不改一行继续工作);
   暗色模式改用 `.dark` 类或 `[data-mode='dark']`,替代 antd algorithm。
3. 验收:全部 Storybook story 视觉快照一致;此阶段不移除任何 antd 用法。

### Stage B —— 组件层(`src/components/ui/`)

1. 经 shadcn CLI + ReUI 注册表(`components.json` → `@reui`)装入:
   button、input、select、dialog、alert-dialog、dropdown-menu、tooltip、popover、tabs、checkbox、
   radio-group、switch、form(react-hook-form + zod)、sonner(toaster)、table 基件。
2. `icons.tsx`:具名图标导出,内部解析为 ReUI Icons(受许可门控)、lucide 兜底;
   将 27 个文件的 `@ant-design/icons` import codemod 到该模块。
3. 替换命令式 API:
   - `message.*` → sonner `toast`;
   - `notification.*` → sonner 富 toast;
   - `App.useApp().modal.confirm` → 基于 alert-dialog 的 `ConfirmDialog` 组件。
4. 验收:`shared/` 完全脱离 antd;未触达模块的图/表仍由 antd 正常渲染。

### Stage C —— 模块迁移(顺序固定)

1. `shared/` —— Stage B 完成。
2. `decision-graph`:侧栏面板、节点卡片、设置标签页、弹窗、模拟器面板。
3. `expression` / `code-editor/business`:表达式构建器表单(react-hook-form + zod),
   日期/时间选择 → shadcn calendar/popover 模式(或 ReUI date-selector)。
4. `decision-table`:用 Tailwind+shadcn 重塑外壳(命令栏、右键菜单、弹窗、表头)。
   **电子表格核心保留 TanStack 自研代码** —— ReUI data-grid 无法建模命中策略矩阵/表达式单元格;
   仅评估用于辅助面板(如 schema 列表)。
5. 每模块验收:typecheck/build 门禁 + Storybook 视觉走查 + 手工冒烟(功能文档 §1–§4 清单)。

### Stage D —— 收尾

1. 从依赖移除 `antd`、`@ant-design/icons`(及仅服务于 antd 的 `dayjs`);删除死 SCSS。
2. 决定剩余 SCSS 去留(允许停在混合形态,渐进转换)。
3. CI:补上缺失的 test job 后方可宣告迁移完成。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 工具类泄漏进宿主应用 | prefix + 关 preflight;用消费方沙箱应用做端到端检查 |
| 双样式系统并存导致包体积膨胀 | Stage D 彻底移除 antd;每阶段监控 dist 体积 |
| antd 命令式 API 语义(message 队列、modal promise)丢失 | 在 sonner/alert-dialog 外包一层 helper 复刻 promise 式 confirm API |
| 图标替换后语义漂移 | icons.tsx 映射表逐 PR 评审;节点侧栏截图 diff |
| ReUI 许可证失效破坏构建 | 许可相关 import 收敛于 icons.tsx;无 key 时兜底路径仍可编译 |

## 范围外

语法/引擎包(npm 承载)、发布流水线重构、超出对等迁移范围的新特性。
