import { DragOutlined, MinusSquareOutlined, PlusSquareOutlined } from '@/icons';
import React from 'react';
import { match } from 'ts-pattern';

import type { DiffStatus } from './decision-graph/dg-types';

export const DiffIcon: React.FC<{
  status?: DiffStatus;
  style?: React.CSSProperties;
  className?: string;
}> = ({ status, style, className }) => {
  return match(status)
    .with('removed', () => (
      <MinusSquareOutlined
        className={className}
        style={{
          color: 'var(--grl-color-error)',
          ...(style || {}),
        }}
      />
    ))
    .with('added', () => (
      <PlusSquareOutlined
        className={className}
        style={{
          color: 'var(--grl-color-success)',
          ...(style || {}),
        }}
      />
    ))
    .with('modified', () => (
      <span
        className={className}
        style={{
          width: style?.fontSize ?? 14,
          height: style?.fontSize ?? 14,
          border: '1.5px solid var(--grl-color-warning)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxSizing: 'border-box',
          ...(style || {}),
        }}
      >
        <span
          style={{
            width: 3,
            height: 3,
            backgroundColor: 'var(--grl-color-warning)',
            borderRadius: '50%',
          }}
        />
      </span>
    ))
    .with('moved', () => (
      <DragOutlined
        className={className}
        style={{
          color: 'var(--grl-color-info)',
          ...(style || {}),
        }}
      />
    ))
    .otherwise(() => null);
};
