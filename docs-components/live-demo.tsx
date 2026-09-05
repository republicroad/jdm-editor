import { DecisionGraph, JdmConfigProvider } from '@republicroad/jdm-editor';
import React from 'react';

/**
 * Client-only live demo: mounts the real kernel editor. Loaded via
 * React.lazy from docs pages so SSG never evaluates the kernel/monaco
 * module chain (which requires window).
 */
export default function LiveDemo() {
  return (
    <div
      data-testid='docs-live-demo'
      style={{
        height: 520,
        border: '1px solid var(--vp-c-border, #ddd)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <JdmConfigProvider>
        <DecisionGraph />
      </JdmConfigProvider>
    </div>
  );
}
