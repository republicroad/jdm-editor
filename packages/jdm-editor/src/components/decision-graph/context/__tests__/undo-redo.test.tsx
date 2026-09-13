// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { DecisionGraphProvider, useDecisionGraphActions, useDecisionGraphState } from '../dg-store.context';

let store: ReturnType<typeof useTestStore>;
function useTestStore() {
  const actions = useDecisionGraphActions();
  const state = useDecisionGraphState((s) => ({
    decisionGraph: s.decisionGraph,
    canUndo: s.canUndo,
    canRedo: s.canRedo,
  }));
  return { actions, ...state };
}

const graphWith = (name: string) => ({
  nodes: [{ id: 'a', type: 'inputNode', name, position: { x: 0, y: 0 } }],
  edges: [] as never[],
});

function TestConsumer() {
  store = useTestStore();
  return null;
}

describe('S009 undo/redo', () => {
  let rendered: ReturnType<typeof render>;

  afterEach(() => {
    rendered?.unmount();
  });

  it('commitUndo → undo → redo 完整生命周期', () => {
    rendered = render(
      <DecisionGraphProvider>
        <TestConsumer />
      </DecisionGraphProvider>,
    );

    // 设为 v1
    act(() => store.actions.setDecisionGraph(graphWith('v1'), { skipOnChangeEvent: true }));

    // 变更到 v2 之前 commit（捕获 v1 状态）
    act(() => store.actions.commitUndo());
    act(() => store.actions.setDecisionGraph(graphWith('v2'), { skipOnChangeEvent: true }));
    expect(store.canUndo).toBe(true);

    // undo 还原到 v1
    act(() => store.actions.undo());
    expect(store.decisionGraph.nodes[0]?.name).toBe('v1');
    expect(store.canRedo).toBe(true);

    // redo 重新应用 v2
    act(() => store.actions.redo());
    expect(store.decisionGraph.nodes[0]?.name).toBe('v2');
  });

  it('undo 空栈不崩溃', () => {
    rendered = render(
      <DecisionGraphProvider>
        <TestConsumer />
      </DecisionGraphProvider>,
    );
    expect(() => store.actions.undo()).not.toThrow();
    expect(() => store.actions.redo()).not.toThrow();
  });

  it('多步 undo → 多步 redo', () => {
    rendered = render(
      <DecisionGraphProvider>
        <TestConsumer />
      </DecisionGraphProvider>,
    );

    act(() => store.actions.setDecisionGraph(graphWith('v1'), { skipOnChangeEvent: true }));

    // 变更到 v2 之前 commit（捕获 v1）
    act(() => store.actions.commitUndo());
    act(() => store.actions.setDecisionGraph(graphWith('v2'), { skipOnChangeEvent: true }));
    act(() => store.actions.commitUndo());
    act(() => store.actions.setDecisionGraph(graphWith('v3'), { skipOnChangeEvent: true }));

    // undo 两次：v3 → v2 → v1
    act(() => store.actions.undo());
    expect(store.decisionGraph.nodes[0]?.name).toBe('v2');
    act(() => store.actions.undo());
    expect(store.decisionGraph.nodes[0]?.name).toBe('v1');

    // redo 两次：v1 → v2 → v3
    act(() => store.actions.redo());
    expect(store.decisionGraph.nodes[0]?.name).toBe('v2');
    act(() => store.actions.redo());
    expect(store.decisionGraph.nodes[0]?.name).toBe('v3');
  });
});
