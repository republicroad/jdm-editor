import React from 'react';

import type { Op } from './constants';

export const OpIcon: React.FC<{ op: Op; size: number; className?: string }> = ({ op, size, className }) =>
  op.icon ? (
    <op.icon size={size} className={className} style={op.rotate ? { transform: 'rotate(180deg)' } : undefined} />
  ) : (
    <span className={className} style={{ fontSize: size }}>
      {op.symbol}
    </span>
  );
