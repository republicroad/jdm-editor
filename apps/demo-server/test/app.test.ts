import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';

// 完整 JDM 决策图（inputNode → decisionTableNode → outputNode）：GOLD → 0.85
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
    { id: 'e1', sourceId: 'in-1', targetId: 'dt-1' },
    { id: 'e2', sourceId: 'dt-1', targetId: 'out-1' },
  ],
};

describe('demo-server api', () => {
  const app = createApp();

  it('healthz 返回 ok 并携带 demo 头', async () => {
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-jdm-demo')).toBe('true');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('validate 接受合法 JDM 决策图', async () => {
    const res = await app.request('/v1/validate', { method: 'POST', body: JSON.stringify(tableModel) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('validate 拒绝缺输入/输出边界的图（zen 引擎级校验）', async () => {
    const res = await app.request('/v1/validate', {
      method: 'POST',
      body: JSON.stringify({
        nodes: [{ id: 'x', type: 'decisionTableNode', name: 'x', position: { x: 0, y: 0 } }],
        edges: [],
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: string };
    expect(body.error).toBe('invalid model');
    expect(typeof body.details).toBe('string');
  });

  it('validate 拒绝非图结构', async () => {
    const res = await app.request('/v1/validate', { method: 'POST', body: JSON.stringify({ nodes: 'nope' }) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid model');
  });

  it('execute 返回决策结果', async () => {
    const res = await app.request('/v1/execute', {
      method: 'POST',
      body: JSON.stringify({ model: tableModel, input: { customer: { tier: 'GOLD' } } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { discount?: { rate?: number } } };
    expect(body.result?.discount?.rate).toBe(0.85);
  });

  it('execute 支持 trace 开关', async () => {
    const res = await app.request('/v1/execute', {
      method: 'POST',
      body: JSON.stringify({ model: tableModel, input: { customer: { tier: 'SILVER' } }, trace: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: unknown; trace?: unknown };
    expect(body).toHaveProperty('trace');
  });

  it('execute 拒绝缺模型', async () => {
    const res = await app.request('/v1/execute', { method: 'POST', body: JSON.stringify({ input: {} }) });
    expect(res.status).toBe(400);
  });
});
