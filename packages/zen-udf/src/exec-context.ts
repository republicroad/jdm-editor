import { AsyncLocalStorage } from 'node:async_hooks';

export interface ExecContext {
  /** 租户标识：多租户运行时强制要求（见 DecisionRuntime.evaluate 入口校验） */
  tenantId?: string;
  userId?: string;
  requestId?: string;
  /**
   * 显式单租户豁免：置 true 后 evaluate 入口不再强制 tenantId，
   * 仅限 CLI / 本地 / 单租户部署使用；多租户服务端禁止开启。
   */
  tenantExempt?: boolean;
}

const execStorage = new AsyncLocalStorage<ExecContext>();

export const getExecContext = (): ExecContext | undefined => {
  return execStorage.getStore();
};

export const runWithExecContext = <T>(ctx: ExecContext, fn: () => Promise<T>): Promise<T> => {
  return execStorage.run(ctx, fn);
};

/**
 * ExecContext 的跨原生边界通道键：zen-engine 的 customNode 回调经 Rust worker →
 * napi TSFN 派发回 JS 主线程，AsyncLocalStorage 不跨该边界存活（探针实证）。
 * DecisionRuntime.evaluate 把当前 ExecContext 以此保留键嵌入输入对象，
 * handleCustomNode 提取后用 runWithExecContext 重建立上下文，并对 passThrough
 * 输出剥离该键。仅对象形态输入支持（数组/原始值输入无法承载）。
 */
export const EXEC_CONTEXT_INPUT_KEY = '__zen_udf_exec_ctx__';
