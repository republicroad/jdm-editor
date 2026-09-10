// @vitest-environment jsdom
import { cleanup } from '@testing-library/react';
import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createExecuteSimulate } from '../../shell/execute-simulate';

vi.mock('@gorules/zen-engine-wasm', () => {
  class VariableType {}
  const init = Object.assign(() => Promise.resolve(), { isReady: () => false });
  return { default: init, isReady: init.isReady, VariableType };
});

// kernel 经 workspace 链接解析到 dist 产物，monaco 是 kernel 的 peerDep、
// appshell 测试环境未安装——桩掉即可。
vi.mock('monaco-editor', () => ({}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const zenOk = {
  result: { discount: { rate: 0.85 } },
  performance: '6.7ms',
  trace: {
    'dt-1': { id: 'dt-1', name: 'discount', input: { tier: 'GOLD' }, output: { rate: 0.85 }, performance: '5ms' },
  },
};

const graph = { nodes: [], edges: [] };

describe('createExecuteSimulate', () => {
  it('成功：/v1/execute 响应映射为 Simulation（trace 键值对齐）', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: zenOk });
    const handler = createExecuteSimulate('http://localhost:8787');

    const { simulation, errorMessage } = await handler(graph as never, { customer: { tier: 'GOLD' } });

    expect(errorMessage).toBeUndefined();
    expect(post).toHaveBeenCalledWith('http://localhost:8787/v1/execute', {
      model: graph,
      input: { customer: { tier: 'GOLD' } },
      trace: true,
    });
    const ok = simulation.result!;
    expect(ok.result).toEqual(zenOk.result);
    expect(ok.performance).toBe('6.7ms');
    expect(ok.snapshot).toBe(graph);
    expect(ok.trace['dt-1']).toEqual({
      id: 'dt-1',
      name: 'discount',
      input: { tier: 'GOLD' },
      output: { rate: 0.85 },
      performance: '5ms',
      traceData: null,
    });
  });

  it('失败：HTTP 错误映射为 error 信封 + errorMessage（不抛出）', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { error: 'execution failed', details: 'boom' } },
      message: 'Request failed with status code 422',
    });
    const handler = createExecuteSimulate();

    const { simulation, errorMessage } = await handler(graph as never, {});

    expect(errorMessage).toBe('execution failed');
    expect(simulation.error?.message).toBe('execution failed');
    expect(simulation.result!.result).toBeNull();
    expect(simulation.result!.snapshot).toBe(graph);
  });
});
