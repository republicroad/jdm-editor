/*
 * Token computation entry (roadmap P0/P4): pure, testable, framework-free.
 *
 * Merge order: calibrated preset ← seed derivation ← explicit overrides.
 * The playground story consumes this directly; GlobalCssVariables is a thin
 * renderer over it. Hex values are the per-mode compat-calibrated presets in
 * presets.ts; seeds only overlay brand families (see derive.ts for the
 * ladder / dark limitation notes).
 */
import { type ThemeSeeds, deriveSeedOverlays } from './derive';
import { MODE_EXTRAS, darkTokens, lightTokens } from './presets';

export type ThemeMode = 'light' | 'dark';

const NODE_COLORS: Record<string, string> = {
  '--node-color-blue': 'var(--seal-color-primary)',
  '--node-color-purple': '#7c4dff',
  '--node-color-orange': '#f76d40',
  '--node-color-green': '#10ac84',
};

/** Compute the full `--seal-*` map for a mode/seeds/overrides combination. */
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
    '--seal-color-border': String(t.colorBorder),
    '--seal-color-border-hover': extras.borderHover,
    '--seal-color-border-fade': extras.borderFade,
    '--seal-color-primary': String(t.colorPrimary),
    ...NODE_COLORS,
    '--seal-color-primary-bg': String(t.colorPrimaryBg),
    '--seal-color-primary-bg-fade': extras.primaryBgFade,
    '--seal-color-primary-bg-hover': String(t.colorPrimaryBgHover),
    '--seal-color-primary-border': String(t.colorPrimaryBorder),
    '--seal-color-primary-border-hover': String(t.colorPrimaryBorderHover),
    '--seal-color-primary-text-hover': String(t.colorPrimaryTextHover),
    '--seal-color-success': String(t.colorSuccess),
    '--seal-color-success-bg': String(t.colorSuccessBg),
    '--seal-color-success-border': String(t.colorSuccessBorder),
    '--seal-color-error': String(t.colorError),
    '--seal-color-error-bg': String(t.colorErrorBg),
    '--seal-color-error-border': String(t.colorErrorBorder),
    '--seal-color-warning': String(t.colorWarning),
    '--seal-color-warning-bg': String(t.colorWarningBg),
    '--seal-color-warning-border': String(t.colorWarningBorder),
    '--seal-color-warning-text': String(t.colorWarningText),
    '--seal-color-info': String(t.colorInfo),
    '--seal-color-info-bg': String(t.colorInfoBg),
    '--seal-color-info-border': String(t.colorInfoBorder),
    '--seal-color-info-text': String(t.colorInfoText),
    '--seal-color-field-input': String(t.colorFieldInput),
    '--seal-color-field-input-hover': String(t.colorFieldInputHover),
    '--seal-color-field-output': String(t.colorFieldOutput),
    '--seal-color-field-output-hover': String(t.colorFieldOutputHover),
    '--seal-color-text-light-solid': String(t.colorTextLightSolid),
    '--seal-color-bg-layout': String(t.colorBgLayout),
    '--seal-color-bg-mask': String(t.colorBgMask),
    '--seal-color-bg-elevated': String(t.colorBgElevated),
    '--seal-color-bg-container': String(t.colorBgContainer),
    '--seal-color-bg-container-disabled': String(t.colorBgContainerDisabled),
    '--seal-color-bg-text-hover': String(t.colorBgTextHover),
    '--seal-color-primary-hover': String(t.colorPrimaryHover),
    '--seal-color-primary-active': String(t.colorPrimaryActive),
    '--seal-color-text': String(t.colorText),
    '--seal-color-text-placeholder': String(t.colorTextPlaceholder),
    '--seal-color-text-base': String(t.colorTextBase),
    '--seal-color-text-disabled': String(t.colorTextDisabled),
    '--seal-color-text-secondary': String(t.colorTextSecondary),
    // L2 removal (docs/archive/research/grl-var-flatten.md): --seal-primary-color(-bg) were
    // exact duplicates of --seal-color-primary(-bg) with zero in-repo
    // consumers; removed with a host migration checklist in that doc.
    '--seal-control-outline': String(t.controlOutline),
    '--seal-font-family': String(t.fontFamily),
    '--seal-line-height': String(t.lineHeight),
    '--seal-border-radius': `${t.borderRadius}px`,
    // raw `--` passthroughs keep host escape-hatch semantics
    ...Object.fromEntries(
      Object.entries(overrides ?? {})
        .filter(([key]) => key.startsWith('--'))
        .map(([key, value]) => [key, String(value)]),
    ),
  };
};
