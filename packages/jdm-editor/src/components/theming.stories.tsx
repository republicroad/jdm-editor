import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useMemo, useState } from 'react';

import { type ThemeMode, computeTheme } from '../theming/compute';
import type { ThemeSeeds } from '../theming/derive';
import { Typography } from './primitives';

/**
 * Seeds Playground (roadmap P4 preview): visualises `computeTheme` output
 * WITHOUT mounting a second JdmConfigProvider — GlobalCssVariables writes
 * global :root styles, so a nested provider would pollute sibling stories.
 *
 * Values are rendered from derived data directly via inline styles; the JSON
 * panel doubles as copy-paste documentation for hosts wiring `--grl-*` maps.
 */

const DEFAULT_SEEDS: ThemeSeeds = {
  primary: '#1677ff',
  success: '#52c41a',
  error: '#ff4d4f',
  warning: '#faad14',
};

type PlaygroundArgs = {
  mode: ThemeMode;
  primary: string;
  success: string;
  error: string;
  warning: string;
  fieldInput: string;
  fieldOutput: string;
};

const FAMILY_KEYS = ['primary', 'success', 'error', 'warning'] as const;

const SwatchRow: React.FC<{ label: string; entries: [string, string][] }> = ({ label, entries }) => (
  <div style={{ marginBottom: 12 }}>
    <Typography.Text strong style={{ fontSize: 12 }}>
      {label}
    </Typography.Text>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      {entries.map(([k, v]) => (
        <div
          key={k}
          title={`${k} = ${v}`}
          style={{
            background: v,
            border: '1px solid rgba(128,128,128,.35)',
            borderRadius: 6,
            padding: '8px 10px',
            minWidth: 96,
            color: '#000000d9',
            fontSize: 11,
            lineHeight: '14px',
            wordBreak: 'break-all',
          }}
        >
          {k.replace(/^--grl-color-/, '')}
        </div>
      ))}
    </div>
  </div>
);

const meta: Meta<PlaygroundArgs> = {
  title: 'Theming',
  parameters: { layout: 'padded' },
  argTypes: {
    mode: { control: 'radio', options: ['light', 'dark'] },
    primary: { control: 'color' },
    success: { control: 'color' },
    error: { control: 'color' },
    warning: { control: 'color' },
    fieldInput: { control: 'color' },
    fieldOutput: { control: 'color' },
  },
};
export default meta;

export const SeedsPlayground: StoryObj<PlaygroundArgs> = {
  args: {
    mode: 'light',
    ...DEFAULT_SEEDS,
    fieldInput: '#acccec',
    fieldOutput: '#c7e0ba',
  },
  render: ({ mode, primary, success, error, warning, fieldInput, fieldOutput }) => {
    const seeds: ThemeSeeds = { primary, success, error, warning, fieldInput, fieldOutput };
    const theme = useMemo(() => computeTheme(mode, seeds), [mode, seeds]);
    const [copied, setCopied] = useState(false);

    const pick = (...names: string[]) =>
      names.map((n) => [n, theme[n]] as [string, string]).filter(([, v]) => v !== undefined);

    const familyBlock = (fam: string) => {
      const keys = Object.keys(theme)
        .filter((k) => k.startsWith(`--grl-color-${fam}`))
        .sort();
      return pick(...keys);
    };

    return (
      <div style={{ maxWidth: 1080 }}>
        <Typography.Title level={5}>Seeds → derived tokens</Typography.Title>
        <Typography.Paragraph type='secondary' style={{ fontSize: 12 }}>
          Values come straight from <code>computeTheme(mode, seeds)</code>. Both modes respond to seeds (dark = OKLab
          hue/lightness transforms over the calibrated navy anchors).
        </Typography.Paragraph>

        <SwatchRow label={`primary (${mode})`} entries={familyBlock('primary')} />
        {FAMILY_KEYS.filter((f) => f !== 'primary').map((f) => (
          <SwatchRow key={f} label={f} entries={familyBlock(f)} />
        ))}
        <SwatchRow
          label='fields'
          entries={[
            ['--grl-color-field-input', theme['--grl-color-field-input']],
            ['--grl-color-field-input-hover', theme['--grl-color-field-input-hover']],
            ['--grl-color-field-output', theme['--grl-color-field-output']],
            ['--grl-color-field-output-hover', theme['--grl-color-field-output-hover']],
            ['--grl-color-text-light-solid', theme['--grl-color-text-light-solid']],
          ]}
        />
        <SwatchRow
          label='surfaces'
          entries={pick(
            '--grl-color-bg-layout',
            '--grl-color-bg-container',
            '--grl-color-bg-elevated',
            '--grl-color-border',
            '--grl-color-border-hover',
            '--grl-control-outline',
          )}
        />

        <div style={{ marginTop: 16 }}>
          <button
            type='button'
            onClick={() => {
              void navigator.clipboard?.writeText(JSON.stringify(theme, null, 2));
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            style={{ padding: '4px 10px', cursor: 'pointer' }}
          >
            {copied ? 'Copied!' : 'Copy --grl-* map'}
          </button>{' '}
          <a
            href='#'
            onClick={(e) => {
              e.preventDefault();
              window.alert(JSON.stringify(theme, null, 2));
            }}
            style={{ fontSize: 12 }}
          >
            view raw
          </a>
        </div>
      </div>
    );
  },
};
