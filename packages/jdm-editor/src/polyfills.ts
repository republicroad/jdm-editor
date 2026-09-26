/**
 * Ported from seal-editor (its ADR-007) — crypto.randomUUID is only exposed in secure contexts (HTTPS /
 * localhost). Plain-HTTP intranet deployments (bare IP / internal domains)
 * are a mainstream environment for this library's audience, so the kernel
 * installs a guard-style polyfill at the package entry: randomUUID is
 * defined only when missing, using the MDN-compatible v4 snippet built on
 * getRandomValues (which is NOT secure-context-only). Server runtimes
 * (Node/Bun) and secure contexts are no-ops; the guard is idempotent and
 * coexists with host-side polyfills (defense in depth).
 *
 * Exposed as a function for tests; evaluated at import time for the entry.
 */

export const installRandomUUIDPolyfill = (): void => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || typeof c.randomUUID === 'function' || typeof c.getRandomValues !== 'function') {
    return;
  }
  c.randomUUID = (): `${string}-${string}-${string}-${string}-${string}` =>
    // MDN compat snippet: the [018] positions of 10000000-1000-4000-8000-
    // 100000000000 are randomized via XOR — full v4 semantics (version and
    // variant bits included).
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (ch) =>
      (Number(ch) ^ (c.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(ch) / 4)))).toString(16),
    ) as `${string}-${string}-${string}-${string}-${string}`;
};

installRandomUUIDPolyfill();
