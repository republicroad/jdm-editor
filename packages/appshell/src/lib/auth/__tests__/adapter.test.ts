import { describe, expect, mock, test } from 'bun:test';

type GetSessionImpl = () => Promise<{ data: unknown }>;
let getSessionImpl: GetSessionImpl = async () => ({ data: null });

mock.module('better-auth/react', () => ({
  createAuthClient: () => ({
    getSession: () => getSessionImpl(),
  }),
}));

const { createAnonymousAdapter, createBetterAuthAdapter } = await import('../adapter');

describe('auth adapter', () => {
  test('anonymous adapter 恒返回 null', async () => {
    const adapter = createAnonymousAdapter();
    expect(await adapter()).toBeNull();
  });

  test('better-auth adapter 映射会话用户为 AuthUser', async () => {
    getSessionImpl = async () => ({ data: { user: { id: 'u-1', name: 'Ann' } } });
    const result = await createBetterAuthAdapter()();
    expect(result).toEqual({ userId: 'u-1' });
  });

  test('无会话时 better-auth adapter 返回 null', async () => {
    getSessionImpl = async () => ({ data: null });
    expect(await createBetterAuthAdapter()()).toBeNull();
  });

  test('会话缺少用户 id 时返回 null', async () => {
    getSessionImpl = async () => ({ data: { user: {} } });
    expect(await createBetterAuthAdapter()()).toBeNull();
  });

  test('getSession 抛错时降级为 null 而非向上传播', async () => {
    getSessionImpl = (() => Promise.reject(new Error('network down'))) as unknown as GetSessionImpl;
    expect(await createBetterAuthAdapter()()).toBeNull();
  });
});
