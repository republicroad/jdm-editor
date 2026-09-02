import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSimulatorRequestBinding } from '../use-simulator-request-binding';

const contentWithTwoExamples = {
  inputs: [],
  schema: {
    'type': 'object',
    'properties': { a: { type: 'string' } },
    'examples': [{ a: '1' }, { a: '2' }],
    'x-examples-meta': [{ name: 'Alpha' }, { name: 'Beta' }],
  },
};

describe('useSimulatorRequestBinding', () => {
  it('returns empty binding state without input node content', () => {
    const { result } = renderHook(() =>
      useSimulatorRequestBinding({ inputNodeContent: undefined, inputNodeId: undefined }),
    );

    expect(result.current.requestSources).toEqual([]);
    expect(result.current.boundRequestSourceIndex).toBe(-1);
    expect(result.current.defaultRequestSourceIndex).toBe(-1);
    expect(result.current.resolvedSimulatorExampleBinding).toBeNull();
    expect(result.current.shouldShowSimulatorSourceSelect).toBe(false);
  });

  it('derives sources and options from schema examples with meta names', () => {
    const { result } = renderHook(() =>
      useSimulatorRequestBinding({ inputNodeContent: contentWithTwoExamples, inputNodeId: 'n1' }),
    );

    expect(result.current.requestSources.map((source) => source.name)).toEqual(['Alpha', 'Beta']);
    expect(result.current.sourceOptions).toEqual([
      { value: 0, label: 'Alpha' },
      { value: 1, label: 'Beta' },
    ]);
    expect(result.current.defaultRequestSourceIndex).toBe(0);
    expect(result.current.resolvedSimulatorExampleBinding).toEqual({
      nodeId: 'n1',
      sourceIndex: 0,
      sourceName: 'Alpha',
    });
  });

  it('respects an explicit binding for the same node', () => {
    const { result } = renderHook(() =>
      useSimulatorRequestBinding({
        inputNodeContent: contentWithTwoExamples,
        inputNodeId: 'n1',
        simulatorExampleBinding: { nodeId: 'n1', sourceIndex: 1 },
      }),
    );

    expect(result.current.boundRequestSourceIndex).toBe(1);
    expect(result.current.defaultRequestSourceIndex).toBe(1);
    expect(result.current.bindingName).toBe('Beta');
    expect(result.current.currentBindingIdentity).toBe('n1:1');
    expect(result.current.shouldShowSimulatorSourceSelect).toBe(true);
  });

  it('ignores bindings pointing at another node or an out-of-range index', () => {
    const otherNode = renderHook(() =>
      useSimulatorRequestBinding({
        inputNodeContent: contentWithTwoExamples,
        inputNodeId: 'n1',
        simulatorExampleBinding: { nodeId: 'other', sourceIndex: 1 },
      }),
    );
    expect(otherNode.result.current.boundRequestSourceIndex).toBe(-1);

    const outOfRange = renderHook(() =>
      useSimulatorRequestBinding({
        inputNodeContent: contentWithTwoExamples,
        inputNodeId: 'n1',
        simulatorExampleBinding: { nodeId: 'n1', sourceIndex: 7 },
      }),
    );
    expect(outOfRange.result.current.boundRequestSourceIndex).toBe(-1);
    expect(outOfRange.result.current.defaultRequestSourceIndex).toBe(0);
  });
});
