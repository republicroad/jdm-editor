import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createGraphsHttpAdapter } from '../graphs-http-adapter';
import { GraphPersistenceError } from '../persistence';

/**
 * 契约语义通过参考 HTTP 适配器验证（GraphPersistenceAdapter 唯一的可执行实现面）：
 * 404 → load null / delete false；409 → GraphPersistenceError('CONFLICT')；其余错误原样上抛。
 */
const http = vi.hoisted(() => {
  const axiosError = (status: number, data?: unknown) => ({
    isAxiosError: true,
    response: { status, data },
  });

  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    axiosError,
    isAxiosError: (e: unknown): boolean =>
      Boolean(e && typeof e === 'object' && (e as { isAxiosError?: boolean }).isAxiosError === true),
  };
});

vi.mock('axios', () => ({ default: http }));

const meta = {
  id: 'g1',
  name: 'demo',
  description: 'd',
  owner: 'u1',
  tags: ['t'],
  extensions: { k: 'v' },
  revision: 'v7',
  auto: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('createGraphsHttpAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('list：GET baseUrl 携带 query，元数据原样映射', async () => {
    http.get.mockResolvedValueOnce({ data: [meta] });
    const adapter = createGraphsHttpAdapter('/api/graphs');

    const list = await adapter.list!({ q: 'de' });

    expect(http.get).toHaveBeenCalledWith('/api/graphs', { params: { q: 'de' } });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'g1', name: 'demo', owner: 'u1', revision: 'v7', tags: ['t'] });
  });

  test('load：head 路径返回 meta+content，缺 session 键时不携带', async () => {
    http.get.mockResolvedValueOnce({ data: { ...meta, content: { nodes: [], edges: [] } } });
    const adapter = createGraphsHttpAdapter('/api/graphs');

    const record = await adapter.load('g1');

    expect(http.get).toHaveBeenCalledWith('/api/graphs/g1', { params: undefined });
    expect(record?.content).toEqual({ nodes: [], edges: [] });
    expect('session' in (record ?? {})).toBe(false);
  });

  test('load：session 兄弟字段随记录返回', async () => {
    const session = { viewport: { x: 1 }, tabs: {} };
    http.get.mockResolvedValueOnce({ data: { ...meta, content: {}, session } });
    const adapter = createGraphsHttpAdapter('/api/graphs');

    expect(await adapter.load('g1')).toMatchObject({ session });
  });

  test('load：revision 查询参数透传', async () => {
    http.get.mockResolvedValueOnce({ data: { ...meta, content: {} } });
    const adapter = createGraphsHttpAdapter('/api/graphs');

    await adapter.load('g1', { revision: 'v3' });

    expect(http.get).toHaveBeenCalledWith('/api/graphs/g1', { params: { revision: 'v3' } });
  });

  test('load：404 语义 → null（不暴露存在性）', async () => {
    http.get.mockRejectedValueOnce(http.axiosError(404));
    const adapter = createGraphsHttpAdapter('/api/graphs');

    expect(await adapter.load('ghost')).toBeNull();
  });

  test('load：非 404 的 axios 错误原样上抛', async () => {
    const err = http.axiosError(500);
    http.get.mockRejectedValueOnce(err);
    const adapter = createGraphsHttpAdapter('/api/graphs');

    await expect(adapter.load('g1')).rejects.toBe(err);
  });

  test('save：有 id 走 PUT，body 含 baseRevision 与 session', async () => {
    http.put.mockResolvedValueOnce({ data: { id: 'g1', revision: 'v8' } });
    const adapter = createGraphsHttpAdapter('/api/graphs');
    const session = { tabs: {} };

    const saved = await adapter.save(
      { ...meta, content: { nodes: [] }, session, revision: 'v7' },
      { baseRevision: 'v7' },
    );

    expect(http.put).toHaveBeenCalledWith('/api/graphs/g1', {
      name: 'demo',
      description: 'd',
      owner: 'u1',
      tags: ['t'],
      extensions: { k: 'v' },
      revision: 'v7',
      auto: false,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      content: { nodes: [] },
      session,
      baseRevision: 'v7',
    });
    expect(saved).toEqual({ id: 'g1', revision: 'v8' });
  });

  test('save：无 id 走 POST（新建）', async () => {
    http.post.mockResolvedValueOnce({ data: { id: 'new', revision: 'v1' } });
    const adapter = createGraphsHttpAdapter('/api/graphs');

    const saved = await adapter.save({ id: '', name: 'n', content: {}, revision: '' });

    expect(http.post).toHaveBeenCalledWith('/api/graphs', {
      name: 'n',
      content: {},
      revision: '',
      baseRevision: undefined,
    });
    expect(saved).toEqual({ id: 'new', revision: 'v1' });
  });

  test('save：HTTP 409 → GraphPersistenceError(CONFLICT)', async () => {
    http.put.mockRejectedValueOnce(http.axiosError(409));
    const adapter = createGraphsHttpAdapter('/api/graphs');

    try {
      await adapter.save({ id: 'g1', name: 'n', content: {}, revision: '' }, { baseRevision: 'stale' });
      expect.unreachable('save should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(GraphPersistenceError);
      expect((e as GraphPersistenceError).code).toBe('CONFLICT');
      expect((e as GraphPersistenceError).message).toContain('stale');
    }
  });

  test('save：响应体 error.code=CONFLICT 同样映射为 CONFLICT', async () => {
    http.put.mockRejectedValueOnce(http.axiosError(400, { error: { code: 'CONFLICT' } }));
    const adapter = createGraphsHttpAdapter('/api/graphs');

    await expect(adapter.save({ id: 'g1', name: 'n', content: {}, revision: '' })).rejects.toMatchObject({
      name: 'GraphPersistenceError',
      code: 'CONFLICT',
    });
  });

  test('delete：成功 true；404 false；其余上抛', async () => {
    const adapter = createGraphsHttpAdapter('/api/graphs');

    http.delete.mockResolvedValueOnce({ data: {} });
    expect(await adapter.delete!('g1')).toBe(true);

    http.delete.mockRejectedValueOnce(http.axiosError(404));
    expect(await adapter.delete!('ghost')).toBe(false);

    const err = http.axiosError(403);
    http.delete.mockRejectedValueOnce(err);
    await expect(adapter.delete!('g1')).rejects.toBe(err);
  });

  test('listVersions：versions 端点载荷透传（含 versionName）', async () => {
    const versions = [
      { revision: 'v1', versionName: 'baseline', updatedAt: '2026-01-01T00:00:00.000Z', auto: false },
      { revision: 'v2', updatedAt: '2026-01-02T00:00:00.000Z', auto: true },
    ];
    http.get.mockResolvedValueOnce({ data: versions });
    const adapter = createGraphsHttpAdapter('/api/graphs');

    expect(await adapter.listVersions!('g1')).toEqual(versions);
    expect(http.get).toHaveBeenCalledWith('/api/graphs/g1/versions');
  });
});
