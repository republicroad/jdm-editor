import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';

import { JdmConfigProvider } from '../theme';
import { Typography } from './primitives';

/**
 * Isolation harness (roadmap Batch S4).
 *
 * Two `.grl-root` islands with independent providers (different modes and
 * seeds) MUST stay mutually oblivious; a host-style probe OUTSIDE the islands
 * must remain untouched; and a light island must NOT ignite `dark:` variants
 * from a page-level dark scope (Batch S2 regression lock).
 */
const meta: Meta = {
  title: 'Theming/Isolation',
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj;

const IsolationStory: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* host-style probe: owns its own semantic var, must never be touched */}
      <div
        data-host-probe=''
        style={
          {
            padding: 12,
            borderRadius: 8,
            '--background': 'magenta',
            background: 'var(--background)',
          } as React.CSSProperties
        }
      >
        <Typography.Text style={{ fontSize: 12 }}>
          host probe — background stays magenta (Batch S1: scoped bridge)
        </Typography.Text>
      </div>

      {/* island A: light / default seeds */}
      <div className='grl-root' data-island='a' style={{ border: '1px solid #888', borderRadius: 8, padding: 12 }}>
        <JdmConfigProvider>
          <div style={{ background: 'var(--grl-color-bg-container)', padding: 8 }}>
            <Typography.Text strong>island A — light / default seeds</Typography.Text>
            <div
              data-dark-probe-a=''
              style={{ padding: 6, marginTop: 6 }}
              className='bg-[var(--grl-color-bg-container)] dark:bg-[var(--grl-color-error)]'
            >
              dark-probe A (light island must keep container bg)
            </div>
          </div>
        </JdmConfigProvider>
      </div>

      {/* island B: dark / violet seeds */}
      <div className='grl-root' data-island='b' style={{ border: '1px solid #888', borderRadius: 8, padding: 12 }}>
        <JdmConfigProvider theme={{ mode: 'dark' }} seeds={{ primary: '#7c3aed' }}>
          <div style={{ background: 'var(--grl-color-bg-container)', padding: 8 }}>
            <Typography.Text strong>island B — dark / violet seeds</Typography.Text>
            <div
              data-dark-probe-b=''
              style={{ padding: 6, marginTop: 6 }}
              className='dark:bg-[var(--grl-color-error)]'
            >
              dark-probe B (dark island — red bg proves variant ignition)
            </div>
          </div>
        </JdmConfigProvider>
      </div>
    </div>
  ),
};
export { IsolationStory as Isolation };
