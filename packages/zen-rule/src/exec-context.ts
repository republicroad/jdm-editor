import { AsyncLocalStorage } from 'node:async_hooks';

export interface ExecContext {
  userId?: string;
  requestId?: string;
}

const execStorage = new AsyncLocalStorage<ExecContext>();

export const getExecContext = (): ExecContext | undefined => {
  return execStorage.getStore();
};

export const runWithExecContext = <T>(ctx: ExecContext, fn: () => Promise<T>): Promise<T> => {
  return execStorage.run(ctx, fn);
};
