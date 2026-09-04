import { type Server, createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const { createDefaultSimulate } = await import('../default-simulate');

describe('createDefaultSimulate', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      const cors = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'POST, OPTIONS',
      };
      if (request.method === 'OPTIONS') {
        response.writeHead(204, cors);
        response.end();
        return;
      }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/api/simulate') {
        if (url.searchParams.get('mode') === 'boom') {
          response.writeHead(500, { ...cors, 'content-type': 'application/json' });
          response.end(JSON.stringify({ source: 'engine exploded', trace: { nodes: [] } }));
          return;
        }
        let body = '';
        for await (const chunk of request) body += chunk;
        const parsed = JSON.parse(body || '{}') as { context?: unknown };
        response.writeHead(200, { ...cors, 'content-type': 'application/json' });
        response.end(JSON.stringify({ result: parsed.context ?? null, performance: '1ms' }));
        return;
      }
      response.writeHead(404, cors);
      response.end('not found');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(() => {
    server.close();
  });

  test('成功路径透传响应体，graph 作为 snapshot', async () => {
    const runSimulate = createDefaultSimulate(`${baseUrl}/api/simulate`);
    const graph = { nodes: [{ id: 'in' }], edges: [] };
    const { simulation, errorMessage } = await runSimulate(graph as never, { age: 21 });

    expect(errorMessage).toBeUndefined();
    expect(simulation.result?.result).toEqual({ age: 21 });
    expect(simulation.result?.snapshot).toEqual(graph as never);
    expect(simulation.error).toBeUndefined();
  });

  test('失败路径把异常信息放入 errorMessage', async () => {
    const runSimulate = createDefaultSimulate(`${baseUrl}/api/simulate?mode=boom`);
    const graph = { nodes: [], edges: [] };
    const { simulation, errorMessage } = await runSimulate(graph as never, {});

    expect(errorMessage).toBe('engine exploded');
    expect(simulation.result?.result).toBeNull();
    expect(simulation.result?.snapshot).toEqual(graph as never);
    expect(simulation.error?.message).toBe('engine exploded');
  });

  test('网络不可达时表现为软错误（不抛出）', async () => {
    const runSimulate = createDefaultSimulate('http://127.0.0.1:1/unreachable');
    const { errorMessage, simulation } = await runSimulate({ nodes: [], edges: [] } as never, {});

    expect(typeof errorMessage).toBe('string');
    expect(errorMessage?.length).toBeGreaterThan(0);
    expect(simulation.error).toBeDefined();
  });
});
