# BP-04：语义三元——效果隔离

## 适用场景

你的系统有 UDF/插件/回调机制，不同回调的**副作用等级**不同——有的是纯读取（查询名单），有的会修改持久状态（频控计数、拉黑账号）。需要机器强制隔离副作用等级，而非依赖作者自觉。

## 核心模型：语义三元

| 语义 | 含义 | 生产执行 | 回放行为 | 审计 |
| --- | --- | --- | --- | --- |
| `query`（缺省） | 纯读取，无状态变更 | 正常执行 | 正常执行（asOf 时钟） | 记录返回值快照 |
| `observe` | 观测累积（计数器/滑窗）——状态变更即计算本身 | 正常执行（含当前事件） | **不重执行**，读 journal | 记录返回值快照 |
| `act` | 处置动作（拉黑/通知/扣款）——效果需幂等提交 | 执行并 journal outcome | **不重执行**，读 journal | 记录 intent + outcome |

## 铁律

1. **声明是 deploy-time 的**：UdfPack 作者在注册时声明语义，运行时强制——缺省 query，未声明 act 不得修改持久状态
2. **回放 fail closed**：journal 缺失 → `REPLAY_JOURNAL_MISS` 错误，宁可回放失败不可静默给新值
3. **act 必须声明 `idempotent: true`**——否则 validatePack 产生警告（verdict 登记页可见）
4. **宿主负责提供通道**：query 的 asOf 时钟、observe 的持久化 store、act 的幂等去重都由宿主注入端口

## 仓内实例

- `packages/zen-udf/src/register.ts` — `semantics` + `idempotent` 字段（Y1/Z1）
- `packages/zen-udf/src/engine.ts` — act-skip 分支（影子评估时 act 不执行）+ journal 读回（Y3 回放模式）
- `packages/zen-udf/src/shadow.test.ts` — act 影子侧不重执行的实证

## 反模式

| 反模式 | 后果 |
| --- | --- |
| 所有 UDF 都标 act | 正常查询也被幂等去重挡住 |
| 回放时不读 journal 而是重新执行 act | 拉黑执行两次 / 计数多加一次 |
| observe 类 UDF 在回放时重新执行 | 计数偏移，回放结论与生产不一致 |
