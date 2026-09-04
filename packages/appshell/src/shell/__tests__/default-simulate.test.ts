import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

const { createDefaultSimulate } = await import('../default-simulate');

describe('createDefaultSimulate', () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch: async (request) => {
        const cors = {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'POST, OPTIONS',
        };
        if (request.method === 'OPTIONS') {
          return new Response(null, { status: 204, headers: cors });
        }
        const url = new URL(request.url);
        if (url.pathname === '/api/simulate') {
          if (url.searchParams.get('mode') === 'boom') {
            return new Response(JSON.stringify({ source: 'engine exploded', trace: { nodes: [] } }), {
              status: 500,
              headers: { ...cors, 'content-type': 'application/json' },
            });
          }
          const body = (await request.json()) as { content?: unknown; context?: unknown };
          return new Response(JSON.stringify({ result: body.context ?? null, performance: '1ms' }), {
            headers: { ...cors, 'content-type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404, headers: cors });
      },
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
  });

  test('成功路径：透传响应并以 graph 作为 snapshot', async () => {
    const runSimulate = createDefaultSimulate(`${baseUrl}/api/simulate`);
    const graph = { nodes: [{ id: 'in' }], edges: [] };
    const { simulation, errorMessage } = await runSimulate(graph as never, { age: 21 });

    expect(errorMessage).toBeUndefined();
    expect(simulation.result?.result).toEqual({ age: 21 });
    expect(simulation.result?.snapshot).toEqual(graph as never);
    expect(simulation.error).toBeUndefined();
  });

  test('失败路径：不抛出，返回错误信封与 errorMessage', async () => {
    const runSimulate = createDefaultSimulate(`${baseUrl}/api/simulate?mode=boom`);
    const graph = { nodes: [], edges: [] };
    const { simulation, errorMessage } = await runSimulate(graph as never, {});

    expect(errorMessage).toBe('engine exploded');
    expect(simulation.result?.result).toBeNull();
    expect(simulation.result?.snapshot).toEqual(graph as never);
    expect(simulation.error?.message).toBe('engine exploded');
  });

  test('网络不可达时降级为错误信封(不抛出)', async () => {
    const runSimulate = createDefaultSimulate('http://127.0.0.1:1/unreachable');
    const { errorMessage, simulation } = await runSimulate({ nodes: [], edges: [] } as never, {});

    expect(typeof errorMessage).toBe('string');
    expect(errorMessage?.length).toBeGreaterThan(0);
    expect(simulation.error).toBeDefined();
  });
});
