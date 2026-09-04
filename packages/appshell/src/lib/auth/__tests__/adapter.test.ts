import { describe, expect, test, vi } from 'vitest';

type GetSessionImpl = () => Promise<{ data: unknown }>;

const mocks = vi.hoisted(() => {
  const state: { session: GetSessionImpl | null } = { session: null };
  return {
    state,
    setSession: (impl: GetSessionImpl | null) => {
      state.session = impl ?? (async () => ({ data: null }));
    },
  };
});

vi.mock('better-auth/react', () => ({
  createAuthClient: () => ({
    getSession: () => (mocks.state.session ?? (async () => ({ data: null })))(),
  }),
}));

const { createAnonymousAdapter, createBetterAuthAdapter } = await import('../adapter');

describe('auth adapter', () => {
  test('anonymous adapter 恒返回 null', async () => {
    const adapter = createAnonymousAdapter();
    expect(await adapter()).toBeNull();
  });

  test('better-auth adapter 映射会话用户为 AuthUser', async () => {
    mocks.setSession(async () => ({ data: { user: { id: 'u-1', name: 'Ann' } } }));
    const result = await createBetterAuthAdapter()();
    expect(result).toEqual({ userId: 'u-1' });
  });

  test('无会话时 better-auth adapter 返回 null', async () => {
    mocks.setSession(async () => ({ data: null }));
    expect(await createBetterAuthAdapter()()).toBeNull();
  });

  test('会话缺少用户 id 时返回 null', async () => {
    mocks.setSession(async () => ({ data: { user: {} } }));
    expect(await createBetterAuthAdapter()()).toBeNull();
  });

  test('getSession 拒绝时降级为 null 而不是抛错', async () => {
    mocks.setSession((() => Promise.reject(new Error('network down'))) as unknown as GetSessionImpl);
    expect(await createBetterAuthAdapter()()).toBeNull();
  });
});
