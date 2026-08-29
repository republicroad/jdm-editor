import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';

import { Typography } from './primitives';
import { SafeBoundary } from './safe-boundary';

/**
 * Interactive SafeBoundary demo (roadmap P1).
 *
 * Toggle the bomb to trigger a rendering crash inside the boundary, then use
 * Retry to recover. Also demonstrates the custom `fallback` prop.
 */
const Bomb: React.FC = () => {
  throw new Error('Simulated rendering crash inside DecisionGraph subtree');
};

type SafeBoundaryDemoArgs = {
  errorTitle: string;
  errorMessage: string;
};

const meta: Meta<SafeBoundaryDemoArgs> = {
  title: 'Theming/SafeBoundary',
  parameters: { layout: 'padded' },
  argTypes: {
    errorTitle: { control: 'text' },
    errorMessage: { control: 'text' },
  },
};
export default meta;

export const Interactive: StoryObj<SafeBoundaryDemoArgs> = {
  args: {
    errorTitle: 'Something went wrong',
    errorMessage: 'Simulated rendering crash inside DecisionGraph subtree',
  },
  render: (args) => {
    void args;
    const [trigger, setTrigger] = useState(false);

    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <button type='button' onClick={() => setTrigger(true)} style={{ padding: '4px 12px', cursor: 'pointer' }}>
            💥 Trigger Error
          </button>
          <button type='button' onClick={() => setTrigger(false)} style={{ padding: '4px 12px', cursor: 'pointer' }}>
            ✅ Reset
          </button>
        </div>

        <SafeBoundary onError={(error) => console.error('[SafeBoundary demo]', error.message)}>
          <div
            style={{
              border: '1px solid var(--grl-color-border, #d9d9d9)',
              borderRadius: 8,
              padding: 16,
            }}
          >
            <Typography.Text strong>Editor content (simulated)</Typography.Text>
            <div style={{ marginTop: 8 }}>
              {trigger && <Bomb />}
              <div style={{ padding: 12, background: 'var(--grl-color-bg-container, #fff)', borderRadius: 6 }}>
                Normal rendering — no errors.
              </div>
            </div>
          </div>
        </SafeBoundary>

        <div style={{ marginTop: 12 }}>
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            Click &quot;Trigger Error&quot; to crash the subtree. SafeBoundary catches it and shows the fallback. Click
            &quot;Reset&quot; to recover.
          </Typography.Text>
        </div>
      </div>
    );
  },
};

export const CustomFallback: StoryObj<SafeBoundaryDemoArgs> = {
  args: {
    errorTitle: 'Custom fallback title',
    errorMessage: 'Custom fallback message',
  },
  render: (args) => {
    const { errorTitle, errorMessage } = args;
    const [trigger, setTrigger] = useState(false);

    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <button
            type='button'
            onClick={() => setTrigger((v) => !v)}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            Toggle Error
          </button>
        </div>

        <SafeBoundary
          fallback={
            <div
              role='alert'
              style={{
                padding: 24,
                border: '2px dashed var(--grl-color-warning-border, #ffe58f)',
                borderRadius: 12,
                textAlign: 'center',
                background: 'var(--grl-color-warning-bg, #fffbe6)',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontWeight: 600 }}>{errorTitle}</div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>{errorMessage}</div>
              <button
                type='button'
                onClick={() => setTrigger(false)}
                style={{ marginTop: 12, padding: '6px 20px', cursor: 'pointer', borderRadius: 6 }}
              >
                Recover
              </button>
            </div>
          }
        >
          <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
            {trigger ? (
              <BombWrapper />
            ) : (
              <Typography.Text>Content rendering normally. Toggle to crash.</Typography.Text>
            )}
          </div>
        </SafeBoundary>
      </div>
    );
  },
};

function BombWrapper(): React.ReactElement {
  throw new Error('Custom fallback demo crash');
}
