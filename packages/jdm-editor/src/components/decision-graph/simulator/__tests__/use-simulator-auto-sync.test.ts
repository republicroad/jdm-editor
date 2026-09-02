import { describe, expect, test } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';

import { AUTO_SYNC_DEBOUNCE_MS, useSimulatorAutoSync } from '../use-simulator-auto-sync';

type HookHarness = {
  result: { current: { flush: () => void } };
  syncedRequests: string[];
  pushedToEditor: string[];
  setRequestValue: (value: string) => void;
  setRequestSourcesSignature: (signature: string) => void;
  setEnabled: (enabled: boolean) => void;
  rerender: () => void;
};

const setupHarness = (overrides?: { enabled?: boolean; requestValue?: string; requestSourcesSignature?: string }) => {
  const syncedRequests: string[] = [];
  const pushedToEditor: string[] = [];
  let requestValue: string = overrides?.requestValue ?? '';
  let requestSourcesSignature: string = overrides?.requestSourcesSignature ?? '';
  let enabled = overrides?.enabled ?? true;

  const harness = renderHook(() =>
    useSimulatorAutoSync({
      enabled,
      requestValue,
      requestSourcesSignature,
      boundRequestSourceIndex: 0,
      onSyncToSchema: () => {
        syncedRequests.push(requestValue ?? '');
      },
      onPushToEditor: () => {
        pushedToEditor.push(requestSourcesSignature ?? '');
      },
      debounceMs: 10,
    }),
  );

  return {
    result: harness.result,
    syncedRequests,
    pushedToEditor,
    setRequestValue: (value: string) => {
      requestValue = value;
      harness.rerender();
    },
    setRequestSourcesSignature: (signature: string) => {
      requestSourcesSignature = signature;
      harness.rerender();
    },
    setEnabled: (value: boolean) => {
      enabled = value;
      harness.rerender();
    },
    rerender: harness.rerender,
  } satisfies HookHarness;
};

describe('useSimulatorAutoSync', () => {
  test('debounces editor edits into a single sync after idle', async () => {
    const h = setupHarness();

    h.setRequestValue('{ "a": 1 }');
    h.setRequestValue('{ "a": 1, "b": 2 }');
    h.setRequestValue('{ "a": 1, "b": 2, "c": 3 }');

    expect(h.syncedRequests).toHaveLength(0);

    await waitFor(() => expect(h.syncedRequests).toHaveLength(1));
    expect(h.syncedRequests[0]).toBe('{ "a": 1, "b": 2, "c": 3 }');
  });

  test('pushes external schema changes to the editor once per signature', async () => {
    const h = setupHarness({ requestSourcesSignature: 'sig-1' });

    await waitFor(() => expect(h.pushedToEditor).toEqual(['sig-1']));

    h.setRequestSourcesSignature('sig-1');
    h.rerender();
    expect(h.pushedToEditor).toHaveLength(1);

    h.setRequestSourcesSignature('sig-2');
    await waitFor(() => expect(h.pushedToEditor).toEqual(['sig-1', 'sig-2']));
  });

  test('flush persists pending edits immediately', async () => {
    const h = setupHarness();

    h.setRequestValue('{ "flush": true }');
    expect(h.syncedRequests).toHaveLength(0);

    h.result.current.flush();
    expect(h.syncedRequests).toEqual(['{ "flush": true }']);
  });

  test('disabled hook never syncs or pushes', async () => {
    const h = setupHarness({ enabled: false });

    h.setRequestValue('{ "a": 1 }');
    h.setRequestSourcesSignature('sig-1');
    h.result.current.flush();

    expect(h.syncedRequests).toHaveLength(0);
    expect(h.pushedToEditor).toHaveLength(0);
  });

  test('exposes the default debounce constant', () => {
    expect(AUTO_SYNC_DEBOUNCE_MS).toBe(700);
  });
});
