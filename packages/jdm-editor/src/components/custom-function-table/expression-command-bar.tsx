import React, { useMemo } from 'react';
import { P, match } from 'ts-pattern';

import { useT } from '../../theming/i18n';
import { Select, Typography } from '../primitives';
import { Stack } from '../stack';
import { useExpressionStore, useExpressionStoreRaw } from './context/expression-store.context';

export const ExpressionCommandBar: React.FC = () => {
  const t = useT();
  const expressionStore = useExpressionStoreRaw();
  const { debugIndex, traceCount } = useExpressionStore(({ debug, debugIndex }) => ({
    debugIndex,
    traceCount: match(debug?.trace?.traceData)
      .with(P.array(), (some) => some.length)
      .otherwise(() => null),
  }));

  const traceIndexOptions = useMemo(() => {
    if (!traceCount) {
      return null;
    }

    return Array.from({ length: traceCount }).map((_, i) => ({
      label: String(i),
      value: i,
    }));
  }, [debugIndex, traceCount]);

  if (!traceIndexOptions) {
    return null;
  }

  return (
    <Stack horizontal horizontalAlign={'space-between'} verticalAlign={'center'} className={'grl-dt__command-bar'}>
      <Stack gap={8} horizontal className='full-width' />
      {traceIndexOptions && (
        <Stack horizontal verticalAlign='center' horizontalAlign='end'>
          <Typography.Text style={{ fontSize: 12 }}>{t('dt.toolbar.simulationIndex')}</Typography.Text>
          <Select
            size='small'
            style={{ fontSize: 12, minWidth: 60 }}
            options={traceIndexOptions}
            onChange={(debugIndex: number) => expressionStore.setState({ debugIndex })}
            value={traceIndexOptions.some((t) => t.value === debugIndex) ? debugIndex : 0}
          />
        </Stack>
      )}
    </Stack>
  );
};
