import React from 'react';
import { P, match } from 'ts-pattern';

import { ExpressionCommandBar as SharedCommandBar } from '../expression/expression-command-bar';
import { useExpressionStore, useExpressionStoreRaw } from './context/expression-store.context';

/**
 * Thin adapter: reads the custom-function expression store and delegates to
 * the shared presentational command bar (keeps the surface's command-bar
 * chrome class).
 */
export const ExpressionCommandBar: React.FC = () => {
  const expressionStore = useExpressionStoreRaw();
  const { debugIndex, traceCount } = useExpressionStore(({ debug, debugIndex }) => ({
    debugIndex,
    traceCount: match(debug?.trace?.traceData)
      .with(P.array(), (some) => some.length)
      .otherwise(() => null),
  }));

  return (
    <SharedCommandBar
      className={'seal-dt__command-bar'}
      debugIndex={debugIndex}
      traceCount={traceCount}
      onDebugIndexChange={(debugIndex: number) => expressionStore.setState({ debugIndex })}
    />
  );
};
