const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";

/* Frozen calibrated antd palettes + mode-scoped constants.
 * Golden-guarded by theming/__tests__/derive.test.ts —
 * do not hand-edit without re-running that suite.
 */

export const MODE_EXTRAS: Record<'light' | 'dark', { borderHover: string; borderFade: string; primaryBgFade: string }> =
  {
    light: { borderHover: '#c3c3c3', borderFade: '#eef0f5', primaryBgFade: '#f8fafc' },
    dark: { borderHover: '#555555', borderFade: '#333333', primaryBgFade: '#141414' },
  };

/** Golden preset (antd-calibrated). Exported for the derive golden test; do
 * not hand-edit without re-running `src/theme/__tests__/derive.test.ts`. */
export const lightTokens: Record<string, string | number> = {
  colorPrimary: '#1677ff',
  colorPrimaryHover: '#4096ff',
  colorPrimaryActive: '#0958d9',
  colorPrimaryBg: '#e6f4ff',
  colorPrimaryBgHover: '#bae0ff',
  colorPrimaryBorder: '#91caff',
  colorPrimaryBorderHover: '#69b1ff',
  colorPrimaryTextHover: '#4096ff',
  colorSuccess: '#52c41a',
  colorSuccessBg: '#f6ffed',
  colorSuccessBorder: '#b7eb8f',
  colorError: '#ff4d4f',
  colorErrorBg: '#fff2f0',
  colorErrorBorder: '#ffccc7',
  colorWarning: '#faad14',
  colorWarningBg: '#fffbe6',
  colorWarningBorder: '#ffe58f',
  colorWarningText: '#d48806',
  colorInfo: '#1677ff',
  colorInfoBg: '#e6f4ff',
  colorInfoBorder: '#91caff',
  colorInfoText: '#1677ff',
  /* Field pills / excel column chips (P1 tokenized literals, formerly
   * inline #acccec family — see GRL-STYLE-HACK HK-10..12). */
  colorFieldInput: '#acccec',
  colorFieldInputHover: '#8ab8de',
  colorFieldOutput: '#c7e0ba',
  colorFieldOutputHover: '#a8cc96',
  colorTextLightSolid: '#ffffff',
  colorBgLayout: '#f5f5f5',
  colorBgMask: 'rgba(0, 0, 0, 0.45)',
  colorBgElevated: '#ffffff',
  colorBgContainer: '#ffffff',
  colorBgContainerDisabled: 'rgba(0, 0, 0, 0.04)',
  colorBgTextHover: 'rgba(0, 0, 0, 0.06)',
  colorBorder: '#d9d9d9',
  colorText: 'rgba(0, 0, 0, 0.88)',
  colorTextPlaceholder: 'rgba(0, 0, 0, 0.25)',
  colorTextBase: '#000000',
  colorTextDisabled: 'rgba(0, 0, 0, 0.25)',
  colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
  controlOutline: 'rgba(5, 145, 255, 0.1)',
  fontFamily,
  lineHeight: 1.5714285714285714,
  borderRadius: 6,
};

export const darkTokens: Record<string, string | number> = {
  ...lightTokens,
  colorPrimary: '#1668dc',
  colorPrimaryHover: '#3c89e8',
  colorPrimaryActive: '#11a8cd',
  colorPrimaryBg: '#111a2c',
  colorPrimaryBgHover: '#112545',
  colorPrimaryBorder: '#15325b',
  colorPrimaryBorderHover: '#3170b9',
  colorPrimaryTextHover: '#3c89e8',
  colorSuccess: '#49aa19',
  colorSuccessBg: '#162312',
  colorSuccessBorder: '#274902',
  colorError: '#dc4446',
  colorErrorBg: '#2c1618',
  colorErrorBorder: '#58181c',
  colorWarning: '#d89614',
  colorWarningBg: '#2b2111',
  colorWarningBorder: '#594214',
  colorWarningText: '#d89614',
  colorInfo: '#1668dc',
  colorInfoBg: '#111a2c',
  colorInfoBorder: '#15325b',
  colorInfoText: '#1668dc',
  colorBgLayout: '#000000',
  colorBgElevated: '#1d1d1d',
  colorBgContainer: '#141414',
  colorBgContainerDisabled: 'rgba(255, 255, 255, 0.08)',
  colorBgTextHover: 'rgba(255, 255, 255, 0.08)',
  colorBorder: '#424242',
  colorText: 'rgba(255, 255, 255, 0.85)',
  colorTextPlaceholder: 'rgba(255, 255, 255, 0.25)',
  colorTextBase: '#ffffff',
  colorTextDisabled: 'rgba(255, 255, 255, 0.25)',
  colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
  controlOutline: 'rgba(22, 104, 220, 0.25)',
};
