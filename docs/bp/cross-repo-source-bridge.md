# BP-07 临时跨项目源码直通（link / portal 桥）

- 日期: 2026-09-15
- 关联: [BP-06 ESM-only 源码发布](./esm-source-publish.md)、[Monorepo App + 多库](./monorepo-app-and-libraries.md)（仓内形态）、`docs/pnpm-workspace-linking.zh-CN.md`、`apps/playground/vite.config.ts`（桥式配置的完整范例）、editor 仓 `docs/19-standalone-dev-and-source-direct-removal.md`（本模式的决策来源）

## 适用场景

**库的某个仓外消费者**（verdict、editor 等独立仓库的应用）需要在 npm 发版前
验证/预览库的**未发布改动**。例如：内核仓修了一个皮肤槽位 bug，verdict 想
在升级版本号之前先在真实应用里确认效果。

前提约束：常驻消费方式必须是 npm semver 包（dist 产物）。源码直通只是
**临时桥**——开发期预览用，用完即拆。仓内 app（同 monorepo）不走本模式，
直接用 workspace + alias（见 [Monorepo App + 多库](./monorepo-app-and-libraries.md)）。

## 核心模型：一个桥，两种接法

| 接法 | 写法（消费者 package.json） | 语义 | 适用 |
| --- | --- | --- | --- |
| **link:**（链产物） | `"@republicroad/jdm-editor": "link:../../jdm-editor/packages/jdm-editor"` | 符号链接到库目录，消费走其 `exports`/`main` → **dist** | 消费者只想看效果，库侧开 watch build（`pnpm --filter @republicroad/jdm-editor dev`） |
| **portal:**（链源码就地安装） | `"@republicroad/jdm-editor": "portal:../../jdm-editor/packages/jdm-editor"` | 同为符号链接，但库自身的依赖装回**库目录内**，改库源码即所见即所得 | 需要调试库源码本身（TS 直通），消费者打包器能编译 TS/CSS |

三工具对照：pnpm 原生支持 `link:` / `portal:` / `file:`（file: 是安装时快照
副本，不随改随动，**不适合**本场景）；npm 只有两步式 `npm link`（等价 link:）；
bun 的 `link:` 语义接近 pnpm 的 `portal:`（依赖装回库目录）。跨工具链消费者
选对应写法即可，模式不变。

**标准操作五步**（以 pnpm 消费者 + portal: 为例）：

1. 消费者 `package.json` 写入 portal:/link: 依赖（路径为相对消费者的库目录）；
2. `pnpm install` 建立符号链接；
3. 消费者 vite 配置三件套（缺一即翻车，见铁律）：
   - `server.fs.allow`：把库所在仓根加进允许列表（默认只许消费者自身根）；
   - `optimizeDeps.exclude`：排除被链的包（预打包会把当时的源码冻结成副本，
     库的改动不生效，甚至因双实例断裂白屏——playground 注释即此案例）；
   - `resolve.alias`：portal: 调试源码时把包名显式指向 `src/index.ts`；
     同仓多包连链时（jdm-editor → appshell）每个包各一条；另加
     `dedupe: ['react', 'react-dom']` 防宿主/库两份 React。
   - 库源码含未编译 CSS 时（本仓 kernel 的 tailwind.css），消费者还需
     `@tailwindcss/vite` 一并处理——参照 playground 配置照抄即可。
4. 起消费者 dev server，库侧改动经 HMR 即时可见；
5. **拆桥**：还原 `package.json` 与 lockfile（git checkout），`pnpm install`。

## 铁律

1. **临时桥不进主干。** link:/portal: 写进 package.json 的改动单独提交或只留
   工作区，验证完立即还原；带 link 依赖的 lockfile 绝不 commit、更不发布。
2. **桥不验证发布面。** alias 到 src 的桥跳过了 dist/exports/类型声明——
   它回答"改动好不好"，不回答"包发出去能不能用"。后者永远走
   `test:consumer` / `test:npm-smoke` + 消费者升 semver 版本号的正式验收。
3. **一次只桥一条链。** 需要同时桥 jdm-editor 与 appshell 时，两条 alias
   一起写、一起拆；只桥其一会出现"一半源码一半 dist"的混合态，类型面与
   运行时面漂移被掩盖。
4. **用完即拆。** 桥是脚手架不是模式——固化成常驻就是 editor 仓四层直通
   考古的重演（见 editor `docs/19` §2）。

## 仓内实例

- `apps/playground/vite.config.ts`——桥式三件套的常驻完整范例
  （alias 源码直通 + optimizeDeps.exclude 防双实例 + dedupe 注释），跨仓桥照抄其结构；
- `docs/bp/monorepo-app-and-libraries.md` §一——源码形态 vs 产物形态的解析铁律；
- editor 仓 `docs/19-standalone-dev-and-source-direct-removal.md` §4.4——
  本模式作为"偶尔需要的临时桥"被写入退役决策。

## 反模式

- ❌ 消费者常驻 portal: 依赖并提交 lockfile——锁死跨仓路径，CI/他人 clone 必炸；
- ❌ 用 `file:` 做源码直通——安装时快照副本，改库不生效，还误以为直通了；
- ❌ 只加 link 不配 `optimizeDeps.exclude`——预打包冻结副本，"改了没效果"；
- ❌ 桥上跑通就发版——桥验证的是源码行为，发布面仍需 smoke + 正式消费者验收；
- ❌ 桥长期不拆——回看 editor 仓 submodule + workspace + paths + alias 四层叠加
  的拆除成本（editor `docs/19` §5），桥放三个月就是四层考古的第五层。
