import React, { useMemo } from 'react';

import { useT } from '../../theming/i18n';
import { Select, Typography } from '../primitives';
import { Stack } from '../stack';

type ExpressionCommandBarProps = {
  debugIndex: number;
  /** null/undefined hides the bar entirely — no trace has been recorded yet */
  traceCount: number | null;
  onDebugIndexChange: (index: number) => void;
  className?: string;
};

/**
 * Presentational trace-index picker shared by the decision-table and
 * custom-function-table expression surfaces. Store-agnostic: callers read
 * their own expression store and pass the debug slice in.
 */
export const ExpressionCommandBar: React.FC<ExpressionCommandBarProps> = ({
  debugIndex,
  traceCount,
  onDebugIndexChange,
  className,
}) => {
  const t = useT();

  const traceIndexOptions = useMemo(() => {
    if (!traceCount) {
      return null;
    }

    return Array.from({ length: traceCount }).map((_, i) => ({
      label: String(i),
      value: i,
    }));
  }, [traceCount]);

  if (!traceIndexOptions) {
    return null;
  }

  return (
    <Stack horizontal horizontalAlign={'space-between'} verticalAlign={'center'} className={className}>
      <Stack gap={8} horizontal className='w-full' />
      {traceIndexOptions && (
        <Stack horizontal verticalAlign='center' horizontalAlign='end'>
          <Typography.Text style={{ fontSize: 12 }}>{t('dt.toolbar.simulationIndex')}</Typography.Text>
          <Select
            size='small'
            style={{ fontSize: 12, minWidth: 60 }}
            options={traceIndexOptions}
            onChange={onDebugIndexChange}
            value={traceIndexOptions.some((option) => option.value === debugIndex) ? debugIndex : 0}
          />
        </Stack>
      )}
    </Stack>
  );
};
