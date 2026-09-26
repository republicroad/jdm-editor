import { afterEach, describe, expect, it } from 'vitest';

import { installRandomUUIDPolyfill } from './polyfills';

/**
 * ADR-007 regression: crypto.randomUUID disappears in non-secure contexts
 * (HTTP + bare IP / intranet domains). The tests below simulate the absence
 * by stubbing the runtime's Crypto prototype, so no real environment is
 * relied on.
 */

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;

if (!cryptoObj) {
  throw new Error('test environment must expose globalThis.crypto');
}

const proto = Object.getPrototypeOf(cryptoObj) as { randomUUID?: unknown };
const hadOwn = Object.prototype.hasOwnProperty.call(proto, 'randomUUID');
const original = proto.randomUUID;

/** Simulate a non-secure context: randomUUID missing, getRandomValues alive. */
const stubAbsence = () => {
  Object.defineProperty(proto, 'randomUUID', { value: undefined, configurable: true });
};

const restore = () => {
  // drop any instance-level polyfill installed on the global object first
  delete (cryptoObj as { randomUUID?: unknown }).randomUUID;
  if (hadOwn) {
    Object.defineProperty(proto, 'randomUUID', { value: original, configurable: true, writable: true });
  } else {
    delete proto.randomUUID;
  }
};

afterEach(restore);

describe('ADR-007 randomUUID polyfill', () => {
  it('is a no-op when randomUUID is already available (secure context / server)', () => {
    expect(typeof cryptoObj.randomUUID).toBe('function');
    const before = cryptoObj.randomUUID;

    installRandomUUIDPolyfill();

    expect(cryptoObj.randomUUID).toBe(before);
  });

  it('installs a valid v4 generator when randomUUID is missing', () => {
    stubAbsence();
    expect(typeof cryptoObj.randomUUID).not.toBe('function');

    installRandomUUIDPolyfill();

    const ids = Array.from({ length: 100 }, () => cryptoObj.randomUUID());
    for (const id of ids) {
      expect(id).toMatch(UUID_V4_RE);
    }
    expect(new Set(ids).size).toBe(100);
  });

  it('is idempotent — a second install never clobbers the live generator', () => {
    stubAbsence();
    installRandomUUIDPolyfill();
    const installed = cryptoObj.randomUUID;

    installRandomUUIDPolyfill();

    expect(cryptoObj.randomUUID).toBe(installed);
    expect(cryptoObj.randomUUID()).toMatch(UUID_V4_RE);
  });
});
