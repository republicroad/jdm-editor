import * as React from 'react';

/**
 * Scoped-injection plumbing (roadmap P3).
 *
 * JdmConfigProvider resolves the nearest `.grl-root` ancestor once on mount
 * and publishes the container element here. Every Radix portal in
 * `components/ui/*` reads it so popovers/dialogs/selects mount INSIDE the
 * island that owns their theme variables — enabling multiple independently-
 * themed islands on one page and bringing the scoped preflight (box-sizing
 * etc.) back over portaled nodes (HK-14 systemic closure).
 *
 * Undefined = no `.grl-root` ancestor → portals fall back to document.body
 * and the provider falls back to global `:root` injection (legacy hosts).
 */

const GrlContainerContext = React.createContext<HTMLElement | undefined>(undefined);

export const GrlContainerProvider: React.FC<
  React.PropsWithChildren<{ container: HTMLElement | undefined }>
> = ({ container, children }) => (
  <GrlContainerContext.Provider value={container}>{children}</GrlContainerContext.Provider>
);

/** Portal target for `components/ui/*` — the island container, if scoped. */
export const useGrlPortalContainer = (): HTMLElement | undefined =>
  React.useContext(GrlContainerContext);
