import axios from 'axios';
import { P, match } from 'ts-pattern';

import type { ShellSimulateResult, SimulateHandler } from './types';

const toErrorMessage = (e: unknown): string =>
  match(e)
    .with(
      {
        response: {
          data: {
            type: P.string,
            source: P.string,
          },
        },
      },
      ({ response: { data: d } }) => `${d.type}: ${d.source}`,
    )
    .with({ response: { data: { source: P.string } } }, (d) => d.response.data.source)
    .with({ response: { data: { message: P.string } } }, (d) => d.response.data.message)
    .with({ message: P.string }, (d) => d.message)
    .otherwise(() => 'Unknown error occurred');

/** 默认模拟实现：同源 POST /api/simulate，错误映射为 Simulation 信封(不抛出，经 errorMessage 传达) */
export const createDefaultSimulate = (url = '/api/simulate'): SimulateHandler => {
  return async (graph, context): Promise<ShellSimulateResult> => {
    try {
      const { data } = await axios.post(url, { context, content: graph });
      return { simulation: { result: { ...data, snapshot: graph } } };
    } catch (e) {
      const responseData = axios.isAxiosError(e) ? e.response?.data : undefined;
      return {
        simulation: {
          result: {
            result: null,
            trace: responseData?.trace,
            snapshot: graph,
            performance: '',
          },
          error: {
            message: responseData?.source,
            data: responseData,
          },
        },
        errorMessage: toErrorMessage(e),
      };
    }
  };
};
