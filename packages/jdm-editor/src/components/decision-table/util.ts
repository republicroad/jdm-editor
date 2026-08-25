import { P, match } from 'ts-pattern';

export const getReferenceMap = (trace: unknown, index: number) => {
  return match(trace)
    .with({ traceData: { reference_map: P._ } }, (s) => s.traceData.reference_map as Record<string, unknown>)
    .with({ traceData: P.array() }, ({ traceData: arr }) => {
      return (arr[index] as { reference_map?: Record<string, unknown> } | undefined)?.reference_map;
    })
    .otherwise(() => undefined);
};
