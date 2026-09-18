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

const runtime = new DecisionRuntime({ registry: createUdfRegistry({ packs: [cachePack] }) });
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

## 2.1 图内调用形态：数组为默认，`;;` 仅旧图兼容

customNode 表达式调用支持两种等价形态（`fn` 恒收 kwargs 关键字对象）：

```jsonc
// 数组形态（默认，2026-09-17 裁决）：编辑器新节点一律产出此形态
{ "value": ["cache.get", "input.key"] }

// ;; 字符串形态（旧图兼容，读取侧永久支持）
{ "value": "cache.get;;input.key" }
```

约定：
- 位置参数按 `parametersSchema` 属性序绑定——**schema 演进时位置参数只在尾部追加**
  （头部/中间插入 = 既有位置调用地雷；JSON Schema 不保证属性有序，这是位置形态的
  固有脆弱点，也是它不做默认的原因）；
- 旧图中的 `;;` 字符串无需迁移，读取侧永久支持；编辑器节点面板保存该节点时
  产出数组形态（存量节点按需随编辑迁移）。

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

## 5. 上架前自检：packChecks

```ts
import { packChecks } from '@republicroad/zen-udf';

const issues = packChecks(cachePack);   // 结构质量层（validatePack 硬门禁之上）
if (issues.some((i) => i.severity === 'error')) throw new Error(JSON.stringify(issues));
```

检查项：description 非空（编辑器面板要渲染）、returnsSchema 存在（§6.5 前提）、
`required ⊆ properties`、timeout 参数形状、act 幂等声明、namespace 命名约定。
建议放进宿主 CI——与 RateStore conformance 套件同一契约即测试思想。

## 6. 反模式

| 反模式 | 后果 |
| --- | --- |
| fn 内自建连接（每调用一次连一次） | 连接风暴；池应在 pack 工厂外建好 |
| 忽略 `call.signal` | 超时后底层调用继续占用连接/算力 |
| 结果里塞函数/Symbol/循环引用 | trace/审计序列化炸或丢数据 |
| 凭证写进 parametersSchema 默认值 | 凭证落图内容，违反多租户纪律 |
| per-tenant 动态注册同名函数 | 注册是 deploy-time 静态行为，撞名注册期硬失败 |
