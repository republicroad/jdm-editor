import type { DecisionGraphType, SimulationTrace } from '@republicroad/jdm-editor';
import axios from 'axios';

import type { ShellSimulateResult, SimulateHandler } from './types';

/** zen-engine trace（demo-server /v1/execute 透传形状） */
type ZenTraceEntry = {
  id: string;
  name: string;
  input?: unknown;
  output?: unknown;
  performance?: string;
  traceData?: unknown;
};

type ExecuteResponse = {
  result?: unknown;
  performance?: string;
  trace?: Record<string, ZenTraceEntry>;
  error?: string;
  details?: unknown;
};

const toTrace = (trace: Record<string, ZenTraceEntry> | undefined): Record<string, SimulationTrace> =>
  Object.fromEntries(
    Object.entries(trace ?? {}).map(([id, t]) => [
      id,
      {
        id: t.id ?? id,
        name: t.name ?? id,
        input: t.input ?? null,
        output: t.output ?? null,
        performance: t.performance ?? null,
        traceData: t.traceData ?? null,
      },
    ]),
  );

/**
 * 模拟实现：POST {baseUrl}/v1/execute（demo-server / verdict 执行方言），
 * `{ model, input, trace: true }` → `{ result, performance, trace }`，
 * 映射为 kernel Simulation 信封（错误不抛出，经 errorMessage 传达）。
 * 与 createDefaultSimulate（/api/simulate 方言）并列，按宿主引擎二选一。
 */
export const createExecuteSimulate = (baseUrl = 'http://localhost:8787'): SimulateHandler => {
  return async (graph: DecisionGraphType, context: unknown): Promise<ShellSimulateResult> => {
    try {
      const { data } = await axios.post<ExecuteResponse>(`${baseUrl}/v1/execute`, {
        model: graph,
        input: context,
        trace: true,
      });
      return {
        simulation: {
          result: {
            result: data.result ?? null,
            performance: data.performance ?? '',
            snapshot: graph,
            trace: toTrace(data.trace),
          },
        },
      };
    } catch (e) {
      const responseData = axios.isAxiosError(e) ? (e.response?.data as ExecuteResponse | undefined) : undefined;
      return {
        simulation: {
          result: {
            result: null,
            trace: toTrace(responseData?.trace),
            snapshot: graph,
            performance: '',
          },
          error: {
            message: responseData?.error,
            data: responseData as never,
          },
        },
        errorMessage: responseData?.error ?? (axios.isAxiosError(e) ? e.message : String(e)),
      };
    }
  };
};
