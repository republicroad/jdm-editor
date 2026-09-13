// 参考函数域装载：import 本包根即向 globalUdfRegistry 注册 contrib 参考域
// （与 0.1.x 行为一致）。需要空注册表（实例隔离）时传 `new UdfRegistry()`，
// 并按需用 loadReferenceInto 装载参考域。
import './reference.ts';

export { DecisionRuntime, type DecisionRuntimeOptions } from './engine.ts';
export {
  DecisionCache,
  type CacheMetricsSnapshot,
  type DecisionCacheEntry,
  type DecisionCacheOptions,
} from './decision-cache.ts';
export { getExecContext, runWithExecContext, type ExecContext } from './exec-context.ts';
export { InMemoryConcurrencyLimiter, NoopConcurrencyLimiter, type ConcurrencyLimiter } from './limiter.ts';
export { registerRoster, listRosters, getRoster, deleteRoster, queryRoster, type Roster } from './roster.ts';
export {
  UdfRegistry,
  globalUdfRegistry,
  registerUdf,
  createExtRegister,
  createUdfRegistry,
  validatePack,
  type UdfPack,
  type CreateUdfRegistryOptions,
  type ContribToolDef,
  type ContribDef,
  type UdfSchema,
  type UdfSchemaParameter,
  type JsonSchema,
  type JsonSchemaProperty,
  type CustomFunctionTool,
  type CustomNodeNamespace,
} from './register.ts';
export { loadReferenceInto, referenceDomains } from './reference.ts';
export {
  setRateStore,
  getRateStore,
  InMemoryRateStore,
  type RateStore,
  type RateCommonResult,
  type GroupDistinctCommonResult,
} from './contrib/rate-window.ts';
