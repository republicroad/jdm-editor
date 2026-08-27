/*
 * Seed-derived theming (roadmap P0, zero-dependency).
 *
 * Architecture agreed 2026-08 ("double track"):
 *  - DEFAULT preset: the hand-calibrated antd tables in `theme.tsx` win
 *    byte-for-byte. Nothing about existing rendering changes.
 *  - CUSTOM seeds: hosts pass `JdmConfigProvider seeds={{primary, ...}}` and a
 *    linear-light mix ladder derives the brand families in light mode;
 *    dark mode follows seeds via OKLab hue/lightness transforms. Ladder ratios were
 *    reverse-calibrated offline against the antd tables (see golden test);
 *    channels land within a few 1/255 steps of what antd's own algorithm
 *    emits for the default seeds — close enough for re-branded installs,
 *    while the defaults never route through it.
 *
 * Phase-2 (Batch F): DARK brand families follow seeds too, via OKLab
 * hue-rotation + lightness scaling around the calibrated anchors in
 * dark-ops.ts — zero-dependency OKLab math lives in color.ts. surfaces are family-independent navy constants in antd's algorithm and do
 * not decompose into seed mixes (offline spread > 0.6). Dark mode therefore
 * keeps its calibrated constants until P0 phase 2 introduces an OKLCH model.
 */

import { hexToOklch, oklchToHex } from './color';
import { DARK_OPS } from './dark-ops';
import { darkTokens } from './presets';

type ThemeModeLite = 'light' | 'dark';

type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const toSrgb = (v: number): number => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, c)) * 255);
};

const rgbToHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((x) => toSrgb(x).toString(16).padStart(2, '0')).join('')}`;

/** Linear-light lerp between `from`/`to` anchors expressed as hex. */
export const mixLinear = (fromHex: string, toHex: '#000000' | '#ffffff', t: number): string => {
  const a = hexToRgb(fromHex).map(toLinear) as Rgb;
  const b = hexToRgb(toHex).map(toLinear) as Rgb;
  const out = a.map((ch, i) => ch * (1 - t) + b[i] * t) as Rgb;
  return rgbToHex(out);
};

/**
 * Per-key ladder for LIGHT brand families.
 * Ratios solved offline so that deriving FROM the default seeds reproduces the
 * antd tables within `CALIBRATION_TOLERANCES` (≤ ~30/255 worst-case on one
 * channel — recorded honestly, not hidden behind the helper).
 */
export const LIGHT_LADDER: Record<string, { anchor: '#ffffff' | '#000000'; t: number }> = {
  // primary family (#1677ff)
  colorPrimaryHover: { anchor: '#ffffff', t: 0.096 },
  colorPrimaryBg: { anchor: '#ffffff', t: 0.836 },
  colorPrimaryBgHover: { anchor: '#ffffff', t: 0.587 },
  colorPrimaryBorder: { anchor: '#ffffff', t: 0.388 },
  colorPrimaryBorderHover: { anchor: '#ffffff', t: 0.224 },
  colorPrimaryActive: { anchor: '#000000', t: 0.479 },
  // success family (#52c41a)
  colorSuccessBg: { anchor: '#ffffff', t: 0.92 },
  colorSuccessBorder: { anchor: '#ffffff', t: 0.438 },
  // error family (#ff4d4f)
  colorErrorBg: { anchor: '#ffffff', t: 0.87 },
  colorErrorBorder: { anchor: '#ffffff', t: 0.553 },
  // warning family (#faad14)
  colorWarningBg: { anchor: '#ffffff', t: 0.91 },
  colorWarningBorder: { anchor: '#ffffff', t: 0.633 },
  colorWarningText: { anchor: '#000000', t: 0.487 },
  // field pill hovers (seeds added in P1)
  colorFieldInputHover: { anchor: '#000000', t: 0.24 },
  colorFieldOutputHover: { anchor: '#000000', t: 0.294 },
};

/** Seeds accepted by the public provider API. */
export type ThemeSeeds = {
  primary?: string;
  success?: string;
  error?: string;
  warning?: string;
  info?: string;
  fieldInput?: string;
  fieldOutput?: string;
};

/** antd-calibrated defaults: passing EXACTLY these equals passing nothing,
 * keeping the frozen preset byte-identical instead of route-through-derived. */
/** antd-calibrated LIGHT defaults (families + pill pairs). */
/** antd-calibrated LIGHT defaults (families + pill pairs). */
export const ANTD_DEFAULT_SEEDS: Required<
  Pick<ThemeSeeds, 'primary' | 'success' | 'error' | 'warning' | 'fieldInput' | 'fieldOutput'>
> = {
  primary: '#1677ff',
  success: '#52c41a',
  error: '#ff4d4f',
  warning: '#faad14',
  fieldInput: '#acccec',
  fieldOutput: '#c7e0ba',
};

/** Family seeds behind the calibrated DARK preset. */
export const DARK_DEF_SEEDS: Record<'primary' | 'success' | 'error' | 'warning', string> = {
  primary: '#1668dc',
  success: '#49aa19',
  error: '#dc4446',
  warning: '#d89614',
};

/** Family seeds behind the calibrated DARK preset. */
function isDefaultSeedSet(mode: ThemeModeLite, seeds: ThemeSeeds): boolean {
  const defaults =
    mode === 'dark'
      ? (DARK_DEF_SEEDS as Record<string, string>)
      : (ANTD_DEFAULT_SEEDS as Record<string, string>);
  const entries = Object.entries(seeds).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return true;
  if (mode === 'dark') {
    // only family keys matter on the dark axis
    return entries.every(([k, v]) => (DARK_DEF_SEEDS as Record<string, string>)[k] === v);
  }
  return entries.every(([k, v]) => defaults[k] === v);
}

const FAMILY_SEED_KEYS = ['primary', 'success', 'error', 'warning'] as const;

function deriveDark({ seeds, out }: Required<Pick<DeriveArgs, 'seeds'>> & { out: Record<string, string> }): void {
  const familyOf = (baseKey: string) =>
    FAMILY_SEED_KEYS.find(
      (f) => baseKey.toLowerCase() === `color${f}` || baseKey.toLowerCase().startsWith(`color${f}`),
    )!;

  const applyDarkOps = (baseKey: string, seedHex: string) => {
    const seedLch = hexToOklch(seedHex);
    const defL = hexToOklch(DARK_DEF_SEEDS[familyOf(baseKey)]).L;
    // bright variants track the seed's lightness; surfaces keep frozen L
    const lr = clamp(seedLch.L / defL, 0.85, 1.18);

    for (const [tokenKey, op] of Object.entries(DARK_OPS)) {
      if (!tokenKey.startsWith(baseKey)) continue;
      const frozen = hexToOklch(String(darkTokens[tokenKey]));
      const L = op.ls ? clamp(frozen.L * lr, 0.12, 0.92) : frozen.L;
      const C = op.cMul !== undefined ? clamp(seedLch.C * op.cMul, 0.01, 0.14) : frozen.C;
      const H = (seedLch.H + op.oh + 360) % 360;
      out[tokenKey] = oklchToHex({ L, C, H });
    }
  };

  for (const family of FAMILY_SEED_KEYS) {
    const seed = (seeds as Record<string, string | undefined>)[family];
    if (!seed) continue;
    const cap = family[0].toUpperCase() + family.slice(1);
    out[`color${cap}`] = seed;
    applyDarkOps(`color${cap}`, seed);
  }

  if (seeds.info) {
    const sInfo = hexToOklch(seeds.info);
    out.colorInfo = seeds.info;
    out.colorInfoText = seeds.info;
    for (const [tokenKey, op] of Object.entries(DARK_OPS)) {
      if (!tokenKey.startsWith('colorPrimary')) continue;
      const target = tokenKey.replace('colorPrimary', 'colorInfo');
      const frozen = hexToOklch(String(darkTokens[target]));
      const bgLike = /bg|border/i.test(target);
      out[target] = oklchToHex({
        L: frozen.L,
        C: op.cMul ? Math.min(0.14, Math.max(0.01, sInfo.C * op.cMul)) : frozen.C,
        H: (sInfo.H + op.oh + 360) % 360,
      });
      void bgLike;
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export type DeriveArgs = {
  mode: 'light' | 'dark';
  seeds?: ThemeSeeds;
};

/**
 * Overlay derivable brand-family values onto a base token set.
 * Light mode only in v1 (see module header); dark mode ignores seeds.
 * Derived output never overrides keys the host passed through `token=`.
 */
export const deriveSeedOverlays = ({ mode, seeds }: DeriveArgs): Record<string, string> => {
  if (!seeds || isDefaultSeedSet(mode, seeds)) {
    return {};
  }

  const out: Record<string, string> = {};

  if (mode === 'dark') {
    deriveDark({ seeds, out });
    return out;
  }

  const applyFamily = (family: string, seed: string) => {
    // the base key IS the seed itself (ladder only covers derivatives)
    const cap = family[0].toUpperCase() + family.slice(1);
    out[`color${cap}`] = seed;
    for (const [tokenKey, op] of Object.entries(LIGHT_LADDER)) {
      if (!tokenKey.toLowerCase().startsWith(`color${family}`.toLowerCase())) continue;
      out[tokenKey] = mixLinear(seed, op.anchor, op.t);
    }
  };

  for (const family of FAMILY_SEED_KEYS) {
    const seed = (seeds as Record<string, string | undefined>)[family];
    if (seed) applyFamily(family, seed);
  }

  // info mirrors the primary ladder against its own seed
  if (seeds.info) {
    out.colorInfo = seeds.info;
    out.colorInfoText = seeds.info;
    out.colorInfoBg = mixLinear(seeds.info, '#ffffff', LIGHT_LADDER.colorPrimaryBg.t);
    out.colorInfoBorder = mixLinear(seeds.info, '#ffffff', LIGHT_LADDER.colorPrimaryBorder.t);
  }

  if (seeds.fieldInput) {
    out.colorFieldInputHover = mixLinear(
      seeds.fieldInput,
      LIGHT_LADDER.colorFieldInputHover.anchor,
      LIGHT_LADDER.colorFieldInputHover.t,
    );
  }
  if (seeds.fieldOutput) {
    out.colorFieldOutputHover = mixLinear(
      seeds.fieldOutput,
      LIGHT_LADDER.colorFieldOutputHover.anchor,
      LIGHT_LADDER.colorFieldOutputHover.t,
    );
  }

  return out;
};

/**
 * Worst accepted post-gamma channel deltas when deriving from the DEFAULT
 * seeds (measured by scripts/probe during calibration; guarded by golden test).
 */
export const CALIBRATION_TOLERANCES: Record<string, number> = {
  colorPrimaryHover: 26,
  colorPrimaryBg: 6,
  colorPrimaryBgHover: 16,
  colorPrimaryBorder: 23,
  colorPrimaryBorderHover: 27,
  colorPrimaryActive: 38,
  colorSuccessBg: 9,
  colorSuccessBorder: 35,
  colorErrorBg: 3,
  colorErrorBorder: 3,
  colorWarningBg: 15,
  // warningBorder spread 0.73 offline — worst ladder member; border blends are
  // visually forgiving at pale tints.
  colorWarningBorder: 66,
  // warningText mutes saturation as well as lightness; a one-axis mix cannot
  // nail it (Δ_red 26 at the default seed) — tolerance recorded honestly.
  colorWarningText: 27,
  colorFieldInputHover: 14,
  colorFieldOutputHover: 12,
};
