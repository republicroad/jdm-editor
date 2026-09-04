import { authClient } from '../auth-client';

export interface AuthUser {
  userId: string;
  displayName?: string;
}

export type AuthAdapter = () => Promise<AuthUser | null>;

export const createAnonymousAdapter = (): AuthAdapter => {
  return async () => null;
};

export const createBetterAuthAdapter = (): AuthAdapter => {
  return async () => {
    try {
      const { data: session } = await authClient.getSession();
      if (!session?.user?.id) {
        return null;
      }
      return { userId: session.user.id };
    } catch {
      return null;
    }
  };
};
