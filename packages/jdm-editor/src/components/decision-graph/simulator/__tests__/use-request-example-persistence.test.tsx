import { renderHook } from '@testing-library/react';
import { mock, describe, expect, it } from 'bun:test';

const messageCalls: Array<{ kind: string; text: string }> = [];

mock.module('antd', () => ({
  message: {
    error: (content: unknown) => messageCalls.push({ kind: 'error', text: String(content) }),
    warning: (content: unknown) => messageCalls.push({ kind: 'warning', text: String(content) }),
    success: (content: unknown) => messageCalls.push({ kind: 'success', text: String(content) }),
  },
}));

type Binding = { nodeId: string; sourceIndex?: number; sourceName?: string };
type GraphNode = { id: string; type: string; content?: Record<string, unknown> };

let mockNodes: GraphNode[] = [];
let mockUpdateCount = 0;
const mockSimulatorRequests: string[] = [];
const mockBindings: Binding[] = [];

mock.module('../../context/dg-store.context', () => ({
  useDecisionGraphRaw: () => ({
    stateStore: { getState: () => ({ decisionGraph: { nodes: mockNodes } }) },
    actions: {
      updateNode: (_id: string, _updater: unknown) => {
        mockUpdateCount += 1;
      },
      setSimulatorRequest: (value: string) => {
        mockSimulatorRequests.push(value);
      },
      setSimulatorExampleBinding: (binding: Binding) => {
        mockBindings.push(binding);
      },
    },
  }),
}));

import { useRequestExamplePersistence } from '../use-request-example-persistence';

const t = ((key: string) => key) as never;

const inputNode = (): GraphNode => ({
  id: 'n1',
  type: 'inputNode',
  content: {
    inputs: [],
    schema: JSON.stringify({
      type: 'object',
      properties: { a: { type: 'string' } },
      examples: [{ a: '1' }],
      'x-examples-meta': [{ name: 'Alpha' }],
    }),
  },
});

const setupGraph = () => {
  mockNodes = [inputNode()];
  mockUpdateCount = 0;
  mockSimulatorRequests.length = 0;
  mockBindings.length = 0;
  messageCalls.length = 0;
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
    expect(messageCalls.at(-1)).toEqual({ kind: 'warning', text: 'requestSelectDataSourceFirst' });
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
    expect(mockUpdateCount).toBe(0);
    expect(messageCalls.at(-1)).toEqual({ kind: 'error', text: 'simulatorRequestMustBeObjectToSave' });
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
    expect(mockUpdateCount).toBe(0);
    expect(messageCalls.at(-1)?.kind).not.toBe('error');
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
    expect(mockUpdateCount).toBe(0);
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
    expect(mockSimulatorRequests).toEqual([formatted]);
    expect(mockBindings.at(-1)?.sourceName).toBe('Alpha');
    expect(mockUpdateCount).toBe(1);
    expect(messageCalls.at(-1)).toEqual({ kind: 'success', text: 'requestDataSourceSaved' });
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
    expect(mockUpdateCount).toBe(0);
    expect(mockSimulatorRequests.length).toBe(0);
    expect(messageCalls.at(-1)).toEqual({ kind: 'success', text: 'requestDataSourceSaved' });
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
    expect(mockUpdateCount).toBe(1);
    expect(messageCalls.filter((call) => call.kind === 'success')).toHaveLength(0);
  });
});
