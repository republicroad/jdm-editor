import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * demo-server 端到端冒烟（W1，补 V7 验收）：真实起服（bun src/main.ts）后走全链路：
 * healthz → validate（合法/缺边界）→ execute 结果断言 → trace 轨迹 → 同模型二连调（L1 缓存复用）。
 * 不在 pnpm verify 内——zen-udf / demo-server 触碰执行链路后运行。
 *
 * Usage: node scripts/probes/demo-server-live.mjs
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const appDir = path.join(root, 'apps', 'demo-server');
const PORT = process.env.DEMO_SERVER_PORT ?? '8788';
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('bun', ['src/main.ts'], {
  cwd: appDir,
  env: { ...process.env, PORT },
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});
let serverOut = '';
server.stdout.on('data', (chunk) => (serverOut += String(chunk)));
server.stderr.on('data', (chunk) => (serverOut += String(chunk)));

const waitForServer = async () => {
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
  }
  throw new Error(`demo-server did not start within 30s. output:\n${serverOut.slice(-2000)}`);
};

const post = async (pathname, body) => {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
};

const tableModel = {
  nodes: [
    { id: 'in-1', type: 'inputNode', name: 'Request', position: { x: 0, y: 0 } },
    {
      id: 'dt-1',
      type: 'decisionTableNode',
      name: 'discount',
      position: { x: 200, y: 0 },
      content: {
        hitPolicy: 'first',
        inputs: [{ id: 'in-tier', name: 'Tier', field: 'customer.tier', fieldType: { type: 'string' } }],
        outputs: [{ id: 'out-rate', name: 'Rate', field: 'discount.rate', outputFieldType: { type: 'number' } }],
        rules: [
          { '_id': 'r1', 'in-tier': '"GOLD"', 'out-rate': '0.85' },
          { '_id': 'r2', 'in-tier': '', 'out-rate': '0' },
        ],
        executionMode: 'single',
        passThrough: false,
      },
    },
    { id: 'out-1', type: 'outputNode', name: 'Response', position: { x: 400, y: 0 } },
  ],
  edges: [
    { id: 'e1', sourceId: 'in-1', targetId: 'dt-1', type: 'edge' },
    { id: 'e2', sourceId: 'dt-1', targetId: 'out-1', type: 'edge' },
  ],
};

let failures = 0;
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`[demo-server-live] ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`[demo-server-live] ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

try {
  await waitForServer();

  // 1. healthz + demo 头
  const health = await fetch(`${BASE}/healthz`);
  check('healthz ok + demo 头', health.ok && health.headers.get('x-jdm-demo') === 'true');

  // 2. validate：合法图
  const valid = await post('/v1/validate', tableModel);
  check('validate 合法图 200', valid.status === 200 && valid.json?.ok === true);

  // 3. validate：缺边界图 400
  const invalid = await post('/v1/validate', {
    nodes: [{ id: 'x', type: 'decisionTableNode', name: 'x', position: { x: 0, y: 0 } }],
    edges: [],
  });
  check('validate 缺边界图 400', invalid.status === 400 && invalid.json?.error === 'invalid model');

  // 4. execute：GOLD → 0.85
  const exec = await post('/v1/execute', { model: tableModel, input: { customer: { tier: 'GOLD' } } });
  check(
    'execute GOLD → 0.85',
    exec.status === 200 && exec.json?.result?.discount?.rate === 0.85,
    JSON.stringify(exec.json),
  );

  // 5. trace=true：zen 节点轨迹存在
  const traced = await post('/v1/execute', {
    model: tableModel,
    input: { customer: { tier: 'SILVER' } },
    trace: true,
  });
  check(
    'execute trace=true 含节点轨迹',
    traced.status === 200 && traced.json?.trace !== undefined,
    JSON.stringify(traced.json).slice(0, 200),
  );

  // 6. 同模型二连调：L1 缓存复用路径（第二次应命中缓存，行为一致）
  const cached = await post('/v1/execute', { model: tableModel, input: { customer: { tier: 'GOLD' } } });
  check('同模型二连调（L1 命中）结果一致', cached.status === 200 && cached.json?.result?.discount?.rate === 0.85);

  // 7. AA2 回放闭环：execute 捕获 audit → replay 一致
  const replaySrc = await post('/v1/execute', {
    model: tableModel,
    input: { customer: { tier: 'GOLD' } },
    trace: true,
  });
  const audit = replaySrc.json?.audit;
  check('execute trace=true 响应携带审计事件', audit !== undefined, JSON.stringify(replaySrc.json).slice(0, 200));

  const replayed = await post('/v1/replay', {
    model: tableModel,
    input: { customer: { tier: 'GOLD' } },
    audit,
  });
  check(
    'replay 一致性核验（consistent true）',
    replayed.status === 200 && replayed.json?.consistent === true,
    JSON.stringify(replayed.json).slice(0, 200),
  );

  // 8. AA1 影子评估：同模型双 rev → equivalent true
  const shadowSame = await post('/v1/shadow', {
    prodModel: tableModel,
    shadowModel: tableModel,
    input: { customer: { tier: 'GOLD' } },
  });
  check(
    'shadow 同模型双 rev equivalent',
    shadowSame.status === 200 && shadowSame.json?.equivalent === true,
    JSON.stringify(shadowSame.json).slice(0, 200),
  );

  // 9. AA1 影子评估：异规则模型 → 字段级差异 + act 不双执行
  const divergentModel = JSON.parse(JSON.stringify(tableModel));
  divergentModel.nodes[1].content.rules[0]['out-rate'] = '0.5';
  const shadowDiff = await post('/v1/shadow', {
    prodModel: tableModel,
    shadowModel: divergentModel,
    input: { customer: { tier: 'GOLD' } },
  });
  check(
    'shadow 异规则 divergent + 字段级差异',
    shadowDiff.status === 200 &&
      shadowDiff.json?.equivalent === false &&
      (shadowDiff.json?.differences?.length ?? 0) > 0,
    JSON.stringify(shadowDiff.json).slice(0, 200),
  );

  // 8. 篡改输入：inputHash 校验拒绝（422）
  const tampered = await post('/v1/replay', {
    model: tableModel,
    input: { customer: { tier: 'SILVER' } },
    audit,
  });
  check('replay 输入篡改 422', tampered.status === 422, JSON.stringify(tampered.json).slice(0, 200));
} catch (error) {
  failures += 1;
  console.error('[demo-server-live] ✗ 探针异常:', error instanceof Error ? error.message : String(error));
} finally {
  server.kill();
}

if (serverOut && failures > 0) {
  console.error('[demo-server-live] server output tail:\n' + serverOut.slice(-1500));
}

console.log(`[demo-server-live] ${failures === 0 ? 'ALL PASS' : `${failures} failure(s)`}`);
process.exit(failures === 0 ? 0 : 1);
