/**
 * Zero-dependency i18n infrastructure (Provider injection, roadmap Option A).
 *
 * Design:
 *  - English messages are the source of truth (`TranslationKey` derives from it)
 *  - `I18nProvider` resolves translations via fallback chain:
 *      consumer overrides → locale messages → English → key itself
 *  - `useT()` returns a translate function with `{{param}}` interpolation
 *  - Locale switching is a simple context value change (no re-render storm)
 */

/** Flat dot-notation message key, e.g. `'dt.toolbar.import'`. */
export type TranslationKey = string;

/** Simple `{{param}}` interpolation parameters. */
export type InterpolationParams = Record<string, string | number>;

/** Full message catalog for a single locale. */
export type MessageCatalog = Record<string, string>;

/** Parse `{{param}}` placeholders in a template string. */
export function interpolate(template: string, params?: InterpolationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{{${key}}}`,
  );
}
