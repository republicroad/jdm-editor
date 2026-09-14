// AA5 性能基线（手动运行）：bun bench/perf.ts
// 与 cache-semantics 哨兵互补——哨兵管语义，本脚本管性能基线；
// zen-engine 升级/新特性落地后运行对照（数字随机器变化，看相对关系）。
import { DecisionRuntime } from '../src/engine.ts';
import { runWithExecContext } from '../src/exec-context.ts';
import { InMemoryConcurrencyLimiter } from '../src/limiter.ts';
import { UdfRegistry } from '../src/register.ts';

const graph = {
  id: 'bench-graph',
  nodes: [
    { id: 'in', type: 'inputNode', name: 'Request' },
    {
      id: 'c1',
      type: 'customNode',
      name: 'custom',
      content: { kind: 'UDF', config: { expressions: [{ id: 'e1', key: 'v', value: 'bench_udf;;x' }] } },
    },
    { id: 'out', type: 'outputNode', name: 'Response' },
  ],
  edges: [
    { id: 'ed1', sourceId: 'in', targetId: 'c1', type: 'edge' },
    { id: 'ed2', sourceId: 'c1', targetId: 'out', type: 'edge' },
  ],
};

const makeRegistry = (): UdfRegistry => {
  const registry = new UdfRegistry();
  registry.registerFunction(function bench_udf(kwargs: Record<string, unknown>) {
    return { v: (kwargs?.x as number) ?? 0 };
  }, 'bench');
  return registry;
};

const N = 200;
const time = async (fn: () => Promise<unknown>): Promise<number> => {
  const start = process.hrtime.bigint();
  for (let i = 0; i < N; i += 1) await fn();
  return Number(process.hrtime.bigint() - start) / 1000 / N; // µs/op
};

const input = { x: 42 };

// a) 每次重建（无缓存语义）
const registryA = makeRegistry();
const runtimeA = new DecisionRuntime({ registry: registryA });
const tRebuild = await runWithExecContext({ tenantExempt: true }, () =>
  time(async () => {
    const d = runtimeA.createDecision(structuredClone(graph));
    await d.evaluate(input);
  }),
);

// b) 缓存实例（L1 命中语义）
const runtimeB = new DecisionRuntime({ registry: makeRegistry() });
await runWithExecContext({ tenantExempt: true }, () => {
  runtimeB.createDecisionWithCacheKey('bench', structuredClone(graph));
  return Promise.resolve();
});
const tCached = await runWithExecContext({ tenantExempt: true }, () =>
  time(() => runtimeB.evaluateAsync('bench', input)),
);

// c) 审计开启（onDecision + 强制 trace）
const events: unknown[] = [];
const runtimeC = new DecisionRuntime({
  registry: makeRegistry(),
  onDecision: (event) => events.push(event),
});
await runWithExecContext({ tenantExempt: true }, () => {
  runtimeC.createDecisionWithCacheKey('bench2', structuredClone(graph));
  return Promise.resolve();
});
const tAudit = await runWithExecContext({ tenantExempt: true }, () =>
  time(() => runtimeC.evaluateAsync('bench2', input)),
);

// d) 并发闸开启
const limiter = new InMemoryConcurrencyLimiter(10);
const runtimeD = new DecisionRuntime({ registry: makeRegistry(), limiter });
await runWithExecContext({ tenantExempt: true }, () => {
  runtimeD.createDecisionWithCacheKey('bench3', structuredClone(graph));
  return Promise.resolve();
});
const tLimiter = await runWithExecContext({ tenantExempt: true }, () =>
  time(() => runtimeD.evaluateAsync('bench3', input)),
);

console.log(`[perf] N=${N}`);
console.log(`[perf] 每次重建 evaluate    : ${tRebuild.toFixed(1)} µs/op`);
console.log(`[perf] L1 缓存命中 evaluate : ${tCached.toFixed(1)} µs/op`);
console.log(`[perf] 审计开启 evaluate    : ${tAudit.toFixed(1)} µs/op（事件 ${events.length} 条）`);
console.log(`[perf] 并发闸开启 evaluate  : ${tLimiter.toFixed(1)} µs/op`);
