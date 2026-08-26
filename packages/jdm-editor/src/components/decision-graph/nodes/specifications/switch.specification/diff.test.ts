import { describe, expect, it } from 'vitest';

import { diffSwitchContent } from './diff';
import type { SwitchStatement } from './types';

const statement = (id: string, condition?: string, isDefault = false): SwitchStatement => ({
  id,
  condition,
  isDefault,
});

describe('diffSwitchContent', () => {
  it('marks hitPolicy changes at the node level', () => {
    const next = diffSwitchContent(
      { hitPolicy: 'collect', statements: [] },
      { hitPolicy: 'first', statements: [] },
    );

    expect(next._diff?.status).toBe('modified');
    // Upstream quirk preserved verbatim: previousValue reads the CURRENT hit policy.
    expect(next._diff?.fields?.hitPolicy).toMatchObject({
      status: 'modified',
      previousValue: 'collect',
    });
  });

  it('flags a modified condition on the statement and bubbles to the parent', () => {
    const next = diffSwitchContent(
      { statements: [statement('s1', 'input.a > 1')] },
      { statements: [statement('s1', 'input.a > 2')] },
    );

    expect(next._diff?.fields?.statements).toMatchObject({ status: 'modified' });
    expect(next.statements?.[0]._diff?.status).toBe('modified');
    expect(next.statements?.[0]._diff?.fields?.condition).toMatchObject({
      status: 'modified',
      previousValue: 'input.a > 2',
    });
  });

  it('ignores identical conditions and leaves the node clean', () => {
    const next = diffSwitchContent(
      { statements: [statement('s1', 'x'), statement('s2', 'y')] },
      { statements: [statement('s1', 'x'), statement('s2', 'y')] },
    );

    expect(next._diff).toBeUndefined();
    // The unified list may attach bookkeeping metadata, but no real change status.
    expect(
      next.statements?.every((s) => !['modified', 'added', 'removed'].includes(s._diff?.status ?? '')),
    ).toBe(true);
  });

  it('treats empty-vs-value as a condition change', () => {
    const next = diffSwitchContent(
      { statements: [statement('s1', 'x')] },
      { statements: [statement('s1')] },
    );

    expect(next.statements?.[0]._diff?.status).toBe('modified');
  });

  it('does not mutate the current input', () => {
    const current = { statements: [statement('s1', 'old')] };
    diffSwitchContent(current, { statements: [statement('s1', 'new')] });

    expect(current.statements?.[0].condition).toBe('old');
    expect(current.statements?.[0]._diff).toBeUndefined();
  });

  it('handles missing statements arrays on either side', () => {
    const added = diffSwitchContent(
      { statements: [statement('s1', 'a')] },
      {},
    );
    expect(added._diff?.status).toBe('modified');

    const removed = diffSwitchContent(
      {},
      { statements: [statement('s1', 'a')] },
    );
    expect(removed._diff?.status).toBe('modified');
  });
});
