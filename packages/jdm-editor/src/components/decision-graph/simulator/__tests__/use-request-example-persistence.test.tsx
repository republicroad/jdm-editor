import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRequestExamplePersistence } from '../use-request-example-persistence';

const mocks = vi.hoisted(() => {
  return {
    messageCalls: [] as Array<{ kind: string; text: string }>,
    nodes: [] as Array<{ id: string; type: string; content?: Record<string, unknown> }>,
    updateCount: 0,
    simulatorRequests: [] as string[],
    bindings: [] as Array<{ nodeId: string; sourceIndex?: number; sourceName?: string }>,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: (content: unknown) => mocks.messageCalls.push({ kind: 'error', text: String(content) }),
    warning: (content: unknown) => mocks.messageCalls.push({ kind: 'warning', text: String(content) }),
    success: (content: unknown) => mocks.messageCalls.push({ kind: 'success', text: String(content) }),
  },
}));

vi.mock('../../context/dg-store.context', () => ({
  useDecisionGraphRaw: () => ({
    stateStore: { getState: () => ({ decisionGraph: { nodes: mocks.nodes } }) },
    actions: {
      updateNode: () => {
        mocks.updateCount += 1;
      },
      setSimulatorRequest: (value: string) => {
        mocks.simulatorRequests.push(value);
      },
      setSimulatorExampleBinding: (binding: { nodeId: string; sourceIndex?: number; sourceName?: string }) => {
        mocks.bindings.push(binding);
      },
    },
  }),
}));

const t = ((key: string) => key) as never;

const inputNode = () => ({
  id: 'n1',
  type: 'inputNode',
  content: {
    inputs: [],
    schema: JSON.stringify({
      'type': 'object',
      'properties': { a: { type: 'string' } },
      'examples': [{ a: '1' }],
      'x-examples-meta': [{ name: 'Alpha' }],
    }),
  },
});

const setupGraph = () => {
  mocks.nodes = [inputNode()];
  mocks.updateCount = 0;
  mocks.simulatorRequests.length = 0;
  mocks.bindings.length = 0;
  mocks.messageCalls.length = 0;
};

describe('useRequestExamplePersistence', () => {
  it('warns and returns null when no example source is bound', () => {
    setupGraph();
    const { result } = renderHook(() =>
      useRequestExamplePersistence({
        t,
        requestValue: '{}',
        resolvedSimulatorExampleBinding: null,
        onRequestValueChange: () => {},
        onMarkEdited: () => {},
      }),
    );

    expect(result.current.persistRequestToExampleSource()).toBeNull();
    expect(mocks.messageCalls.at(-1)).toEqual({ kind: 'warning', text: 'request.selectDataSourceFirst' });
  });

  it('rejects non-object request payloads with an error message', () => {
    setupGraph();
    const { result } = renderHook(() =>
      useRequestExamplePersistence({
        t,
        requestValue: '[1,2]',
        resolvedSimulatorExampleBinding: { nodeId: 'n1', sourceIndex: 0 },
        onRequestValueChange: () => {},
        onMarkEdited: () => {},
      }),
    );

    expect(result.current.persistRequestToExampleSource()).toBeNull();
    expect(mocks.updateCount).toBe(0);
    expect(mocks.messageCalls.at(-1)).toEqual({ kind: 'error', text: 'simulator.requestMustBeObjectToSave' });
  });

  it('reports missing bound node silently on demand', () => {
    setupGraph();
    const { result } = renderHook(() =>
      useRequestExamplePersistence({
        t,
        requestValue: '{"a":"9"}',
        resolvedSimulatorExampleBinding: { nodeId: 'ghost', sourceIndex: 0 },
        onRequestValueChange: () => {},
        onMarkEdited: () => {},
      }),
    );

    expect(result.current.persistRequestToExampleSource({ silentOnError: true })).toBeNull();
    expect(mocks.updateCount).toBe(0);
    expect(mocks.messageCalls.at(-1)?.kind).not.toBe('error');
  });

  it('returns null on malformed json5 payload', () => {
    setupGraph();
    const { result } = renderHook(() =>
      useRequestExamplePersistence({
        t,
        requestValue: '{broken',
        resolvedSimulatorExampleBinding: { nodeId: 'n1', sourceIndex: 0 },
        onRequestValueChange: () => {},
        onMarkEdited: () => {},
      }),
    );

    expect(result.current.persistRequestToExampleSource({ silentOnError: true })).toBeNull();
    expect(mocks.updateCount).toBe(0);
  });

  it('saves parsed request into bound schema example and syncs editor callbacks', () => {
    setupGraph();
    let externalValue: string | undefined;
    let markedEdited = false;

    const { result } = renderHook(() =>
      useRequestExamplePersistence({
        t,
        requestValue: '{"a":"2"}',
        resolvedSimulatorExampleBinding: { nodeId: 'n1', sourceIndex: 0, sourceName: 'Alpha' },
        onRequestValueChange: (value: string) => {
          externalValue = value;
        },
        onMarkEdited: () => {
          markedEdited = true;
        },
      }),
    );

    const formatted = '{\n  "a": "2"\n}';
    const outcome = result.current.persistRequestToExampleSource();

    expect(outcome).toEqual({ context: { a: '2' }, formatted });
    expect(markedEdited).toBe(true);
    expect(externalValue).toBe(formatted);
    expect(mocks.simulatorRequests).toEqual([formatted]);
    expect(mocks.bindings.at(-1)?.sourceName).toBe('Alpha');
    expect(mocks.updateCount).toBe(1);
    expect(mocks.messageCalls.at(-1)).toEqual({ kind: 'success', text: 'request.dataSourceSaved' });
  });

  it('skips the store update when the target example already matches', () => {
    setupGraph();
    const { result } = renderHook(() =>
      useRequestExamplePersistence({
        t,
        requestValue: '{\n  "a": "1"\n}',
        resolvedSimulatorExampleBinding: { nodeId: 'n1', sourceIndex: 0, sourceName: 'Alpha' },
        onRequestValueChange: () => {},
        onMarkEdited: () => {},
      }),
    );

    const outcome = result.current.persistRequestToExampleSource();
    expect(outcome).toEqual({ context: { a: '1' }, formatted: '{\n  "a": "1"\n}' });
    expect(mocks.updateCount).toBe(0);
    expect(mocks.simulatorRequests.length).toBe(0);
    expect(mocks.messageCalls.at(-1)).toEqual({ kind: 'success', text: 'request.dataSourceSaved' });
  });

  it('auto-sync persists silently without success toast', () => {
    setupGraph();
    const { result } = renderHook(() =>
      useRequestExamplePersistence({
        t,
        requestValue: '{"a":"7"}',
        resolvedSimulatorExampleBinding: { nodeId: 'n1', sourceIndex: 0, sourceName: 'Alpha' },
        onRequestValueChange: () => {},
        onMarkEdited: () => {},
      }),
    );

    const outcome = result.current.persistRequestToExampleSource({
      showSuccessMessage: false,
      triggeredBy: 'auto-sync',
    });

    expect(outcome).toEqual({ context: { a: '7' }, formatted: '{\n  "a": "7"\n}' });
    expect(mocks.updateCount).toBe(1);
    expect(mocks.messageCalls.filter((call) => call.kind === 'success')).toHaveLength(0);
  });
});
