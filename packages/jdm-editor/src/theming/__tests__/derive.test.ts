import { describe, expect, it } from 'vitest';

import { lightTokens } from '../../theme';
import {
  CALIBRATION_TOLERANCES,
  LIGHT_LADDER,
  deriveSeedOverlays,
  mixLinear,
} from '../derive';

const hexChannels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

describe('theme seed derivation (P0)', () => {
  it('no seeds → empty overlay: frozen preset is untouched (byte parity)', () => {
    expect(deriveSeedOverlays({ mode: 'light' })).toEqual({});
    expect(deriveSeedOverlays({ mode: 'light', seeds: {} })).toEqual({});
    // dark mode intentionally ignores seeds in v1 (module header limitation)
    expect(deriveSeedOverlays({ mode: 'dark', seeds: { primary: '#7c3aed' } })).toEqual({});
  });

  it('default-seed derivation lands within recorded calibration tolerances', () => {
    const derived = deriveSeedOverlays({
      mode: 'light',
      seeds: {
        primary: lightTokens.colorPrimary as string,
        success: lightTokens.colorSuccess as string,
        error: lightTokens.colorError as string,
        warning: lightTokens.colorWarning as string,
        fieldInput: '#acccec',
        fieldOutput: '#c7e0ba',
      },
    });
    expect(Object.keys(derived).length).toBeGreaterThanOrEqual(12);

    const failures: string[] = [];
    for (const [key, got] of Object.entries(derived)) {
      const want = lightTokens[key] as string | undefined;
      if (!want) continue; // keys without a frozen counterpart (none today)
      const tol = CALIBRATION_TOLERANCES[key] ?? 40;
      const a = hexChannels(got);
      const b = hexChannels(want);
      const d = a.map((ch, i) => Math.abs(ch - b[i]));
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
