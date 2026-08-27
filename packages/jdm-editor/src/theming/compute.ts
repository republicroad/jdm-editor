/*
 * Token computation entry (roadmap P0/P4): pure, testable, framework-free.
 *
 * Merge order: calibrated preset ← seed derivation ← explicit overrides.
 * The playground story consumes this directly; GlobalCssVariables is a thin
 * renderer over it. Hex values are the per-mode antd-calibrated presets in
 * presets.ts; seeds only overlay brand families (see derive.ts for the
 * ladder / dark limitation notes).
 */
import { deriveSeedOverlays, type ThemeSeeds } from './derive';
import { MODE_EXTRAS, darkTokens, lightTokens } from './presets';

export type ThemeMode = 'light' | 'dark';

const NODE_COLORS: Record<string, string> = {
  '--node-color-blue': 'var(--grl-color-primary)',
  '--node-color-purple': '#7c4dff',
  '--node-color-orange': '#f76d40',
  '--node-color-green': '#10ac84',
};

/** Compute the full `--grl-*` map for a mode/seeds/overrides combination. */
export const computeTheme = (
  mode: ThemeMode,
  seeds?: ThemeSeeds,
  overrides?: Record<string, unknown>,
): Record<string, string> => {
  const base = mode === 'dark' ? darkTokens : lightTokens;
  const derived = deriveSeedOverlays({ mode, seeds });
  const t: Record<string, string | number> = {
    ...base,
    ...derived,
    ...(overrides as Record<string, string | number>),
  };
  const extras = MODE_EXTRAS[mode];

  return {
    '--grl-color-border': String(t.colorBorder),
    '--grl-color-border-hover': extras.borderHover,
    '--grl-color-border-fade': extras.borderFade,
    '--grl-color-primary': String(t.colorPrimary),
    ...NODE_COLORS,
    '--grl-color-primary-bg': String(t.colorPrimaryBg),
    '--grl-color-primary-bg-fade': extras.primaryBgFade,
    '--grl-color-primary-bg-hover': String(t.colorPrimaryBgHover),
    '--grl-color-primary-border': String(t.colorPrimaryBorder),
    '--grl-color-primary-border-hover': String(t.colorPrimaryBorderHover),
    '--grl-color-primary-text-hover': String(t.colorPrimaryTextHover),
    '--grl-color-success': String(t.colorSuccess),
    '--grl-color-success-bg': String(t.colorSuccessBg),
    '--grl-color-success-border': String(t.colorSuccessBorder),
    '--grl-color-error': String(t.colorError),
    '--grl-color-error-bg': String(t.colorErrorBg),
    '--grl-color-error-border': String(t.colorErrorBorder),
    '--grl-color-warning': String(t.colorWarning),
    '--grl-color-warning-bg': String(t.colorWarningBg),
    '--grl-color-warning-border': String(t.colorWarningBorder),
    '--grl-color-warning-text': String(t.colorWarningText),
    '--grl-color-info': String(t.colorInfo),
    '--grl-color-info-bg': String(t.colorInfoBg),
    '--grl-color-info-border': String(t.colorInfoBorder),
    '--grl-color-info-text': String(t.colorInfoText),
    '--grl-color-field-input': String(t.colorFieldInput),
    '--grl-color-field-input-hover': String(t.colorFieldInputHover),
    '--grl-color-field-output': String(t.colorFieldOutput),
    '--grl-color-field-output-hover': String(t.colorFieldOutputHover),
    '--grl-color-text-light-solid': String(t.colorTextLightSolid),
    '--grl-color-bg-layout': String(t.colorBgLayout),
    '--grl-color-bg-mask': String(t.colorBgMask),
    '--grl-color-bg-elevated': String(t.colorBgElevated),
    '--grl-color-bg-container': String(t.colorBgContainer),
    '--grl-color-bg-container-disabled': String(t.colorBgContainerDisabled),
    '--grl-color-bg-text-hover': String(t.colorBgTextHover),
    '--grl-color-primary-hover': String(t.colorPrimaryHover),
    '--grl-color-primary-active': String(t.colorPrimaryActive),
    '--grl-color-text': String(t.colorText),
    '--grl-color-text-placeholder': String(t.colorTextPlaceholder),
    '--grl-color-text-base': String(t.colorTextBase),
    '--grl-color-text-disabled': String(t.colorTextDisabled),
    '--grl-color-text-secondary': String(t.colorTextSecondary),
    '--grl-control-outline': String(t.controlOutline),
    '--grl-primary-color': String(t.colorPrimary),
    '--grl-primary-color-bg': String(t.colorPrimaryBg),
    '--grl-font-family': String(t.fontFamily),
    '--grl-line-height': String(t.lineHeight),
    '--grl-border-radius': `${t.borderRadius}px`,
    // raw `--` passthroughs keep host escape-hatch semantics
    ...Object.fromEntries(
      Object.entries(overrides ?? {})
        .filter(([key]) => key.startsWith('--'))
        .map(([key, value]) => [key, String(value)]),
    ),
  };
};
