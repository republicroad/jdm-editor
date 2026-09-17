import { useMemo, useRef } from 'react';

/**
 * Stabilizes a selector result with a pluggable equality function, following
 * the same useRef + useMemo pattern as zustand v5's `useShallow`, and keeping
 * the hasMemo semantics of the former `useStoreWithEqualityFn`
 * (use-sync-external-store/with-selector): the comparator is never invoked
 * before a previous result exists, so custom comparators may assume
 * non-undefined arguments.
 */
export function useMemoEquality<S, T>(
  selector: (state: S) => T,
  equalityFn: (a: any, b: any) => boolean,
): (state: S) => T {
  const prev = useRef<T | undefined>(undefined);
  const hasPrev = useRef(false);

  return useMemo(
    () => (state: S) => {
      const next = selector(state);
      if (!hasPrev.current) {
        hasPrev.current = true;
        prev.current = next;
        return next;
      }
      return equalityFn(prev.current, next) ? prev.current! : (prev.current = next);
    },
    [selector, equalityFn],
  );
}
