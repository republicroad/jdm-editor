# 品牌清扫 Codemod — `grl-` → `seal-`

- **日期**：2026-09-26
- **状态**：已在本仓 `reui` 线执行；对齐 seal-editor 仓 `2636adf` 提交的同名清扫
- **工具**：[`scripts/brand-sweep-codemod.mjs`](../../scripts/brand-sweep-codemod.mjs)

## 为什么

fork 的 CSS/标识符前缀 `grl-` 早于 `seal` 产品品牌。seal-editor 仓（npm 产品线）
已在 1.1.0 完成 `grl-` → `seal-` 清扫。本仓执行同一清扫，目的：

1. 双仓共享同一套样式/主题词汇，本仓（reui 线）的创新成果 cherry-pick 进产品线
   时不再有重命名摩擦；
2. 宿主在两个发行版上消费同一契约（`--seal-*` token、`.seal-root` 作用域）。

## codemod

`scripts/brand-sweep-codemod.mjs` 已参数化（`--from grl --to seal` 为默认值）、
**幂等**、并排除自身源文件。有序规则——后一条规则只处理前面规则剩余的部分：

| # | 规则 | 命中对象 | 示例 |
|---|---|---|---|
| 1 | `GRL-` → `SEAL-` | 技术债标记 | `GRL-STYLE-HACK` → `SEAL-STYLE-HACK`、`GRL-LAYER-GUARD` → `SEAL-LAYER-GUARD` |
| 2 | `Grl` → `Seal` | PascalCase 标识符 | `GrlPortalContainer` → `SealPortalContainer`、`GrlContainerProvider` → `SealContainerProvider` |
| 3 | `grl-` → `seal-` | CSS 类名、作用域、自定义属性 | `grl-root` → `seal-root`、`grl-dg` → `seal-dg`、`grl-ce-*` → `seal-ce-*`、`--grl-color-*` → `--seal-color-*` |
| 4 | `grl` → `seal` | 其余 camelCase / 裸标识符 | `grlContainer` → `sealContainer` |

### 本仓执行记录

- **范围**：`packages/**`（src、测试、stories、README）、`scripts/*.mjs`、
  有效 `docs/**`——共扫描 708 个文件。
- **替换量**：主批次 137 文件 / 1,525 处
  （`grl-` 1,441 · `GRL-` 21 · `Grl` 37 · `grl` 26），包 README 补扫 20 处
  → **合计约 1,545 处 / 141 文件**。
- **零残留校验**：排除项之外 `grep -ri grl` 无任何命中。

### 排除项

- `docs/archive/**` —— 历史记录保留原名（与 seal-editor 清扫同一裁决）。
- `@gorules/*` 上游谱系 —— 词法天然安全：`grl` 不是 `gorules` 的子串。
- `localStorage.gru-hl-view` —— 另一遗留前缀（`gru-`），且是运行时键：
  改名会静默重置既有用户的设置。

### 特殊处理

`docs/archive/research/grl-var-flatten.md` 保留历史文件名。有效引用已改指
归档真实路径（原 `docs/grl-var-flatten.md` 是死链，涉及
`theming/compute.ts` 与 `host-migration-guide` 中英两份）。

## 宿主破坏性变更提示

本次清扫中存活的名称全部同步重命名、保持自洽：主题 token（`--seal-color-*`）、
作用域类（`.seal-root`、`.seal-dg`、`.seal-ce-*`）、组件类
（`seal-textarea-input`、`seal-function__*` 等）。覆盖库样式的宿主需按上表
规则机械重命名自己的 `.grl-*` / `--grl-*` 选择器。

## 门禁（清扫后全绿）

| 门禁 | 结果 |
| --- | --- |
| 内核 vitest（CI=true） | 447/447（顺带清掉 1 个 obsolete snapshot——vitest 命名格式变更的历史遗留，`vitest -u`） |
| appshell vitest | 154/154 |
| storybook 交互套件 | 14 套件 / 70 用例 |
| 内核 + appshell `tsc --noEmit` | 干净（appshell 需补内核 `#*` 子路径映射——见下） |
| 构建（内核 + appshell） | 通过 |
| 包体积 | 重新校准——见下 |
| style-debt | `!important` 12/18 · raw-hex 0/0 |
| eslint + react-compiler + prettier | 干净 |
| consumer smoke（react 18 & 19、table-only measure） | 全部宿主 PASS |

### 体积预算重校准

`seal-` 比 `grl-` 每处多 1 字节，约 1.5k 处重命名落入发布产物。清扫后本地
（Windows）实测：`index.js` 679.2kB raw / 166.2kB gzip，`style.css`
116.5kB raw / 18.7kB gzip。预算按既定 CI-Linux 系数（本地 × 1.025 后向上取整）：

- `index.js`：raw 675,000 → **700,000**，gzip 166,000 → **172,000**
- `style.css`：raw 115,000 → **121,000**，gzip 18,500 → **19,500**
- （`index.js` gzip 172,000 与 seal-editor 校准值一致。）

### appshell 源码直通类型检查

appshell 经 tsconfig `paths` 直通编译内核 `src/`；内核靠自身的
`#* → ./src/*` paths 解析 `#reui/*`、`#lib/*`、`#icons` 子路径导入。
appshell 缺少镜像条目，在较新的 `#reui/*` 导入（节点卡片工作）上失败。
修复：`packages/appshell/tsconfig.json` 增加 `"#*": ["../jdm-editor/src/*"]`。

## 复现

```bash
node scripts/brand-sweep-codemod.mjs --dry   # 预览
node scripts/brand-sweep-codemod.mjs         # 执行（幂等）
# 校验
grep -ri grl packages/ scripts/ docs/ -l | grep -v archive | grep -v node_modules
pnpm format && pnpm lint:compiler && pnpm lint:debt && pnpm size
pnpm test && pnpm --filter @republicroad/jdm-appshell test
```
