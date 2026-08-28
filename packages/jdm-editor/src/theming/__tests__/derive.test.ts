import { describe, expect, it } from 'vitest';

import { darkTokens, lightTokens } from '../../theme';
import { hexToOklch, hueDelta } from '../color';
import { DARK_OPS } from '../dark-ops';
import { CALIBRATION_TOLERANCES, LIGHT_LADDER, deriveSeedOverlays, mixLinear } from '../derive';

const seedLchH = (hex: string) => hexToOklch(hex).H;
const bakedOhFor = (key: string) => DARK_OPS[key]?.oh ?? 0;

const hexChannels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

describe('theme seed derivation (P0)', () => {
  it('no seeds → empty overlay: frozen preset is untouched (byte parity)', () => {
    expect(deriveSeedOverlays({ mode: 'light' })).toEqual({});
    expect(deriveSeedOverlays({ mode: 'light', seeds: {} })).toEqual({});
    // exactly-default seed set ⇒ no-op in BOTH modes (byte parity preserved)
    expect(
      deriveSeedOverlays({
        mode: 'dark',
        seeds: { primary: '#1668dc', success: '#49aa19', error: '#dc4446', warning: '#d89614' },
      }),
    ).toEqual({});
  });

  it('DARK: custom seed derives hue-following family outputs', () => {
    const violet = '#7c3aed';
    const out = deriveSeedOverlays({ mode: 'dark', seeds: { primary: violet } });
    expect(out.colorPrimary).toBe(violet);

    const seeded = Object.keys(out).filter((k) => k.startsWith('colorPrimary'));
    expect(seeded.length).toBeGreaterThanOrEqual(7); // base + 7 dark ops

    for (const key of seeded) {
      if (key === 'colorPrimary') continue;
      const lch = hexToOklch(out[key]);
      const base = hexToOklch((darkTokens as Record<string, string>)[key]);
      // hue follows the new brand within the baked offset window
      const dHue = Math.abs(hueDelta(lch.H, (seedLchH(violet) + bakedOhFor(key) + 360) % 360));
      expect(dHue, `${key} hue`).toBeLessThan(3); // anchors rounded to 2dp + roundtrip noise
      // surfaces keep their calibrated lightness band
      expect(lch.L, `${key} L`).toBeGreaterThan(0.05);
      void base;
    }
  });

  it('light ladder formulas stay within calibration tolerances vs antd frozen', () => {
    const seedOf: Record<string, string> = {
      primary: '#1677ff',
      success: '#52c41a',
      error: '#ff4d4f',
      warning: '#faad14',
      fieldInput: '#acccec',
      fieldOutput: '#c7e0ba',
    };
    const failures: string[] = [];
    for (const [key, op] of Object.entries(LIGHT_LADDER)) {
      const fam = Object.keys(seedOf).find((f) => key.toLowerCase().startsWith(`color${f}`));
      if (!fam) continue;
      const got = mixLinear(seedOf[fam], op.anchor, op.t);
      const want = lightTokens[key] as string | undefined;
      if (!want) continue;
      const d = hexChannels(got).map((ch, i) => Math.abs(ch - hexChannels(want)[i]));
      const tol = CALIBRATION_TOLERANCES[key] ?? 40;
      if (d.some((x) => x > tol)) {
        failures.push(`${key}: got ${got} want ${want} Δ=[${d.join(',')}] tol=${tol}`);
      }
    }
    if (failures.length > 0) {
      console.table(failures);
      console.error(failures.join('\n'));
    }
    expect(failures).toEqual([]);
  });

  it('custom seed actually shifts the family outputs', () => {
    const purple = '#7c3aed';
    const out = deriveSeedOverlays({ mode: 'light', seeds: { primary: purple } });
    expect(out.colorPrimaryBg).not.toBe(lightTokens.colorPrimaryBg);
    // bg must still be a very light tint of the new hue family
    const [r, g, b] = hexChannels(out.colorPrimaryBg);
    expect(Math.max(r, g, b)).toBeGreaterThan(220);
    expect(b).toBeGreaterThanOrEqual(r); // violet keeps blue dominance
  });

  it('mixLinear anchors behave (pure formulas)', () => {
    expect(mixLinear('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixLinear('#000000', '#ffffff', 1)).toBe('#ffffff');
    // monotonic between anchors
    const a = hexChannels(mixLinear('#1677ff', '#ffffff', 0.2));
    const b = hexChannels(mixLinear('#1677ff', '#ffffff', 0.4));
    expect(a[1]).toBeLessThanOrEqual(b[1]);
  });

  it('ladder covers exactly the documented derivable keys', () => {
    expect(Object.keys(LIGHT_LADDER).sort()).toMatchSnapshot();
  });
});
