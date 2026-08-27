/*
 * Minimal sRGB ↔ OKLab conversion (Björn Ottosson's public-domain matrices),
 * zero dependencies. Enough surface for hue-preserving palette derivation
 * (roadmap P0 phase-2): roundtrip error stays within ±1/255 per channel.
 */

type Rgb = [number, number, number];

const srgbToLinearCh = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const linearToSrgbCh = (v: number): number => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, c)) * 255);
};

export const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgbToHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;

export type OkLab = { L: number; a: number; b: number };

export const hexToOkLab = (hex: string): OkLab => {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinearCh) as Rgb;

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

export const okLabToHex = ({ L, a, b }: OkLab): string => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return rgbToHex([linearToSrgbCh(r), linearToSrgbCh(g), linearToSrgbCh(bb)]);
};

export type Oklch = { L: number; C: number; H: number };

export const okLabToOklch = ({ L, a, b }: OkLab): Oklch => ({
  L,
  C: Math.sqrt(a * a + b * b),
  H: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
});

export const oklchToOkLab = ({ L, C, H }: Oklch): OkLab => {
  const rad = (H * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
};

/** Convenience: hex → polar form. */
export const hexToOklch = (hex: string): Oklch => okLabToOklch(hexToOkLab(hex));

/** Polar form → hex. Derived palette colors stay near antd's in-gamut anchors,
 * so no gamut search is needed; CM clamps at conversion time anyway. */
export const oklchToHex = (c: Oklch): string => okLabToHex(oklchToOkLab(c));

/** Shortest signed delta between two hues, in degrees (-180..180]. */
export const hueDelta = (fromH: number, toH: number): number => {
  let d = (((toH - fromH) % 360) + 540) % 360 - 180;
  if (d === -180) d = 180;
  return d;
};
