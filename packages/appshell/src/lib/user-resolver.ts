import { createBetterAuthAdapter, type AuthAdapter } from './auth/adapter';

// 内核 barrel 未导出 UserResolver（声明在 decision-graph/dg-types）——按 0.2.x host 契约本地镜像
export type UserResolver = () => Promise<{ user?: string }> | null;

export const createUserResolver = (adapter: AuthAdapter): UserResolver => {
  return async () => {
    try {
      const authUser = await adapter();
      if (!authUser) {
        return { user: '' };
      }
      return { user: authUser.userId };
    } catch {
      return { user: '' };
    }
  };
};

export const createBetterAuthResolver = (): UserResolver => {
  return createUserResolver(createBetterAuthAdapter());
};
