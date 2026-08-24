import React from 'react';

const cardStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  maxWidth: 480,
  padding: '4px 12px',
  background: 'var(--grl-color-bg-elevated)',
  border: '1px solid var(--grl-color-border)',
  borderRadius: 8,
  boxShadow: 'var(--grl-box-shadow-secondary, 0 6px 16px rgba(0,0,0,0.12))',
  fontSize: 12,
  lineHeight: '20px',
  color: 'var(--grl-color-text)',
  cursor: 'grabbing',
  pointerEvents: 'none',
};

const chipStyle: React.CSSProperties = {
  maxWidth: 140,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const DragOverlayCard: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className='grl-drag-overlay' style={cardStyle}>
    {children}
  </div>
);

export const OverlayChip: React.FC<{ children: React.ReactNode; width?: number }> = ({ children, width }) => (
  <span style={{ ...chipStyle, ...(width ? { maxWidth: width } : {}) }}>{children}</span>
);

export const OverlayIndexChip: React.FC<{ index: number }> = ({ index }) => (
  <span
    style={{
      minWidth: 20,
      textAlign: 'center',
      padding: '0 4px',
      borderRadius: 4,
      background: 'var(--grl-color-primary-bg, var(--grl-color-bg-layout))',
      color: 'var(--grl-color-primary)',
      fontWeight: 500,
    }}
  >
    {index + 1}
  </span>
);
