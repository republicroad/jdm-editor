# 宿主自定义函数指南（基于 zen-udf 实现扩展函数）

面向宿主开发者：如何在应用里基于 zen-udf 实现自定义函数——尤其是**重 I/O 逻辑**
（访问 Redis、专有数据库、第三方 API）。

## 1. 最小可用：UdfPack + 闭包捕获客户端

工具是普通函数，**长生命周期的重资源（连接池）由宿主创建、经闭包捕获**：

```ts
import { defineToolFor, type UdfPack } from '@republicroad/zen-udf';
import Redis from 'ioredis';

const pool = new Redis.Cluster(['redis-0:6379']);          // 宿主创建、宿主销毁

export const cachePack: UdfPack = {
  namespace: 'cache',
  tools: [
    defineToolFor<{ key: string }>({
      name: 'get',
      description: '读取租户缓存值',
      parametersSchema: {
        properties: { key: { type: 'string', title: 'Key' } },
        required: ['key'],
        title: 'cache.get',
        type: 'object',
      },
      returnsSchema: { type: 'string', title: 'value' },
      fn: async (kwargs, call) => pool.get(`${call?.tenantId ?? 'default'}:${kwargs.key}`),
    }),
  ],
};

const runtime = new DecisionRuntime({ registry: createUdfRuntime({ packs: [cachePack] }) });
```

要点：
- `defineToolFor<TParams>` 给 kwargs 静态类型（schema 仍是运行时唯一权威）；
- `fn` 第二参数 `call: ToolCallContext`（见 §2）；
- 连接池的销毁在**宿主自己的关闭序列**里（`process.on('SIGTERM', …)` / DI 容器
  destroy 钩子）——zen-udf 不做 registry 生命周期钩子，所有权不倒挂。

## 2. ToolCallContext：租户身份 + 取消信号

```ts
interface ToolCallContext {
  namespace?: string;      // 工具所属域
  name: string;            // 注册名
  tenantId?: string;       // 多租户身份——数据键必须带它
  userId?: string;
  requestId?: string;
  signal: AbortSignal;     // 超时/上游取消时 abort
  deadlineAt: number | null;
}
```

**重 I/O 函数必须把 `call.signal` 传给底层客户端**，否则运行时超时返回
`UDF_TIMEOUT` 后，底层调用仍占着连接继续执行：

```ts
fn: async (kwargs, call) => {
  // ioredis 示例：不支持 AbortSignal 时用 call?.deadlineAt 做 lazy 判断 +
  // 客户端自带 commandTimeout；原生支持 signal 的客户端(pg / undici)直接透传
  return db.query(sql, { signal: call?.signal });
},
```

运行时超时（`kwargs.timeout`，§6.2）到点时：结果返回结构化
`{ error: { code: 'UDF_TIMEOUT' } }` **且** `signal` abort。

## 2.1 图内调用形态：三模（JSON-RPC 式类型判别），数组为默认

customNode 表达式调用支持三种等价形态（`fn` 恒收 kwargs 关键字对象，
**序列化形态不得泄漏进 trace 语义**——绑定后的 kwargs 与 trace 三形态完全一致）：

```jsonc
// 数组 = 位置调用（默认，2026-09-17 裁决）：编辑器新节点一律产出此形态
{ "value": ["cache.get", "input.key"] }

// 对象 = 命名调用：$call 保留键 + 具名实参（推荐用于可选参数 / 3+ 参数 / 手写图）
{ "value": { "$call": "cache.get", "key": "input.key", "timeout": 80 } }

// ;; 字符串（legacy，旧图兼容，读取侧永久支持）
{ "value": "cache.get;;input.key" }
```

命名形态细则：字符串实参 = zen 表达式（按 inputField 前缀求值），非字符串 = 字面量；
未知参数名报 `INVALID_PARAM: unknown argument`（手写图防笔误）；required/default
与位置语义同一套规则。

约定：
- 位置形态按 `parametersSchema` 属性序绑定——**schema 演进时位置参数只在尾部追加**
  （头部/中间插入 = 既有位置调用地雷；JSON Schema 不保证属性有序，这是位置形态的
  固有脆弱点，也是它不做唯一形态的原因）；
- 旧图中的 `;;` 字符串无需迁移，读取侧永久支持；编辑器节点面板保存该节点时
  产出数组形态，面板提供位置 ↔ 命名一键互转（存量节点按需随编辑迁移）；
- **禁嵌套不变量**：`$call` 的值只能是函数名（字符串），**不是表达式**——一个表达式
  项恰好一次调用，想组合请拆节点。这是节点级 trace 的根基（业界对应：Step Functions /
  DMN invocation 同样强制扁平单调用；嵌套表达式语言正是 trace 不可追溯的根源）。

## 3. 免费搭乘的运行时设施

注入即得，函数内零代码：

| 设施 | 行为 |
| --- | --- |
| 并发闸 `limiter` | per-tenant 信号量；打满时排队等待（等待耗时计入 metrics） |
| 熔断 `breaker` | per-tenant:func 键；打开时**fn 根本不执行**，快速失败 `CIRCUIT_OPEN` |
| 指标 `metricsSink` | 每次调用（`kind:'udf'`）、熔断拒绝、闸等待三类事件 |
| trace / 审计 journal | 耗时、错误码、semantics 进 traceData；act/observe 进审计 |
| `resultValidation` | 按 `returnsSchema` 校验返回值（warn 记账 / enforce 拦截） |
| 脱敏 sanitize | trace 出口统一过脱敏层 |

## 4. 必守约定

1. **结果必须 JSON 可序列化**——进 trace、跨副本回放；
2. **不抛异常**：失败返回结构化错误 `{ error: { code: 'XXX', message } }`
   （内建错误码表：`INVALID_PARAM / UDF_TIMEOUT / INVALID_RESULT / UDF_NOT_FOUND /
   UDF_ERROR / CIRCUIT_OPEN`；业务自定义码用 `UDF_ERROR` + message 或自有前缀）;
3. **租户差异只在数据面**：`call.tenantId` 进你的数据键；禁止 per-tenant 注册、
   禁止图内容携带凭证（凭证走 http 域的 `SecretResolver` 模式）;
4. **`kwargs.timeout` 约定**：声明 `timeout` 参数（integer）即自动获得运行时
   强制超时；重 I/O 函数务必声明它;
5. **semantics / idempotent**：`query/observe/act` 三语义决定审计与回放行为
   （act 类未声明 `idempotent` 会被 `packWarnings`/`packChecks` 提示）。

## 5. 结果缓存：函数作者自决（闭包 loader 模式）

框架契约（2026-10-10 立法）：**每次调用 = 真实执行**——zen-udf 没有结果缓存层，
是否缓存、粒度、时窗、容量都是**函数作者的业务判断**，在函数实现内部自行完成。
引擎视角无任何特例：每次调用都真实进入 `run`，只是函数内部决定「这次从自己的
缓存里拿」——审计与 trace 照常记账（命中条目耗时近零，本身就是命中信号）。

推荐形态 = **工厂 + 闭包缓存**：宿主**按请求创建函数实例**，缓存随请求生死——
无 TTL、无失效策略、天然不跨请求读陈旧值（GraphQL DataLoader 同款语义）：

```ts
import { Type } from '@sinclair/typebox';
import { createUdfRuntime, pack, tool, type UdfPackDef } from '@republicroad/zen-udf';

export function createRosterPack({ roster }: { roster: RosterClient }): UdfPackDef {
  const cache = new Map<string, unknown>();              // 闭包状态 = 私有缓存
  const inflight = new Map<string, Promise<unknown>>();  // single-flight：并发同参合流

  return pack({
    id: 'roster',
    tools: [
      tool({
        namespace: 'roster',
        name: 'lookup',
        description: '按 user_id 查 roster 档案（实例内自缓存）',
        semantics: 'query',
        input: Type.Object({ user_id: Type.String() }),
        output: Type.Record(Type.String(), Type.Unknown()),
        run: async ({ user_id }, ctx) => {
          const key = `${ctx?.tenantId ?? 'default'}:${user_id}`;
          const hit = cache.get(key);
          if (hit !== undefined) return hit;
          const pending = inflight.get(key);              // 同参在途 → 复用同一 Promise
          if (pending) return pending;
          const executing = roster.find(user_id).then(
            (row) => { cache.set(key, row); inflight.delete(key); return row; },
            (err) => { inflight.delete(key); throw err; }, // 只缓存成功——错误不进缓存
          );
          inflight.set(key, executing);
          return executing;
        },
      }),
    ],
  });
}

// 宿主：HTTP 中间件里每请求一次——实例丢弃时闭包缓存随之回收
const runtime = createUdfRuntime({ packs: [createRosterPack({ roster })] });
```

同一决策内三处同参调用 → 一次真实底层执行 + 两次闭包命中；并发同参（实例依赖
调度下多节点并行）经 `inflight` 合流，不击穿底层。

### 进程单例形态的注意义务

宿主若只建一次实例（缓存跨请求存活），义务全部移交函数作者：

| 义务 | 说明 |
| --- | --- |
| 键完整性 | `tenantId` + 全部实质输入 + pack `meta.version` 进键——漏一项即跨租户串号/升级后陈旧读 |
| 有界 | Map 换 LRU 或定期清扫——长命进程防泄漏 |
| 只缓存成功 | 错误可能是瞬态，重复失败交给熔断；缓存错误 = 钉死故障 |
| act 永不缓存 | 处置效果漏执行不可逆；observe 自担时间性（「同值窗口」是业务判断） |
| 可观测 | 作者层打 hit/miss；框架侧每次调用照常记账，耗时近零即命中 |

`ToolContext` 已携带 `tenantId/requestId/userId`——即使单例形态，按请求/租户
分片缓存键所需的料框架已给齐，无需任何新支持。

## 6. 上架前自检：packChecks

```ts
import { packChecks } from '@republicroad/zen-udf';

const issues = packChecks(cachePack);   // 结构质量层（validatePack 硬门禁之上）
if (issues.some((i) => i.severity === 'error')) throw new Error(JSON.stringify(issues));
```

检查项：description 非空（编辑器面板要渲染）、returnsSchema 存在（§6.5 前提）、
`required ⊆ properties`、timeout 参数形状、act 幂等声明、namespace 命名约定。
建议放进宿主 CI——与 RateStore conformance 套件同一契约即测试思想。

## 7. 反模式

| 反模式 | 后果 |
| --- | --- |
| fn 内自建连接（每调用一次连一次） | 连接风暴；池应在 pack 工厂外建好 |
| 忽略 `call.signal` | 超时后底层调用继续占用连接/算力 |
| 结果里塞函数/Symbol/循环引用 | trace/审计序列化炸或丢数据 |
| 凭证写进 parametersSchema 默认值 | 凭证落图内容，违反多租户纪律 |
| per-tenant 动态注册同名函数 | 注册是 deploy-time 静态行为，撞名注册期硬失败 |
| 单例形态缓存键缺 tenantId/版本（§5） | 跨租户串号 / pack 升级后陈旧读 |
