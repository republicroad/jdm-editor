import { act, render } from '@testing-library/react';
import React, { useContext } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DecisionGraphProvider, DecisionGraphStoreContext } from '../context/dg-store.context';
import type { DecisionEdge, DecisionNode } from '../dg-types';
import { privateSymbol } from '../dg-types';

type ContextValue = React.ContextType<typeof DecisionGraphStoreContext>;

let ctx: ContextValue | null = null;

const Probe: React.FC = () => {
  ctx = useContext(DecisionGraphStoreContext);
  return null;
};

const renderProvider = () => {
  render(
    <DecisionGraphProvider>
      <Probe />
    </DecisionGraphProvider>,
  );
  if (!ctx) {
    throw new Error('provider context was not captured');
  }
  return ctx;
};

const inputNode = (id = 'in'): DecisionNode => ({ id, name: 'Input', type: 'inputNode', position: { x: 0, y: 0 } });
const tableNode = (id = 'dt'): DecisionNode => ({
  id,
  name: 'Table',
  type: 'decisionTableNode',
  position: { x: 10, y: 10 },
});
const edge = (id: string, sourceId: string, targetId: string): DecisionEdge => ({
  id,
  sourceId,
  targetId,
  type: 'edge',
});

describe('decision graph store actions', () => {
  let context: ContextValue;

  beforeEach(() => {
    context = renderProvider();
    const setNodes = vi.fn();
    const onNodesChange = vi.fn();
    const setEdges = vi.fn();
    const onEdgesChange = vi.fn();

    context.referenceStore.setState({
      nodesState: { current: [[], setNodes, onNodesChange] } as never,
      edgesState: { current: [[], setEdges, onEdgesChange] } as never,
    });
  });

  it('replaces the whole graph and notifies listeners', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.setDecisionGraph({ nodes: [inputNode()], edges: [edge('e1', 'in', 'dt')] });
    });

    const { decisionGraph } = context.stateStore.getState();
    expect(decisionGraph.nodes).toHaveLength(1);
    expect(decisionGraph.edges).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(decisionGraph);
  });

  it('can skip the onChange event when requested', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.setDecisionGraph({ nodes: [tableNode()] }, { skipOnChangeEvent: true });
    });

    expect(context.stateStore.getState().decisionGraph.nodes).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds nodes and filters additional inputs when one already exists', () => {
    context.referenceStore.setState({
      nodesState: { current: [[{ id: 'rf-in', type: 'inputNode' }] as never, vi.fn(), vi.fn()] } as never,
    });

    act(() => {
      context.actions.addNodes([inputNode('second'), tableNode()]);
    });

    const { nodes } = context.stateStore.getState().decisionGraph;
    expect(nodes.map((node) => node.id)).toEqual(['dt']);
  });

  it('appends all nodes when no input exists yet', () => {
    act(() => {
      context.actions.addNodes([inputNode(), tableNode()]);
    });

    expect(context.stateStore.getState().decisionGraph.nodes).toHaveLength(2);
  });

  it('removes nodes together with attached edges and type metadata', () => {
    context.stateStore.setState({
      decisionGraph: {
        nodes: [inputNode(), tableNode()],
        edges: [edge('e1', 'in', 'dt')],
      },
      nodeTypes: { in: {} } as never,
    });

    act(() => {
      context.actions.removeNodes(['in']);
    });

    const { decisionGraph, nodeTypes } = context.stateStore.getState();
    expect(decisionGraph.nodes.map((node) => node.id)).toEqual(['dt']);
    expect(decisionGraph.edges).toHaveLength(0);
    expect(nodeTypes).not.toHaveProperty('in');
  });

  it('applies position changes to the matching node', () => {
    context.stateStore.setState({
      decisionGraph: { nodes: [inputNode()], edges: [] },
    });
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.handleNodesChange([
        { id: 'in', type: 'position', position: { x: 42, y: 24 }, dragging: false } as never,
      ]);
    });

    expect(context.stateStore.getState().decisionGraph.nodes[0].position).toEqual({ x: 42, y: 24 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('records selection and dimension metadata under the private symbol', () => {
    context.stateStore.setState({
      decisionGraph: { nodes: [tableNode()], edges: [] },
    });

    act(() => {
      context.actions.handleNodesChange([{ id: 'dt', type: 'select', selected: true } as never]);
      context.actions.handleNodesChange([
        { id: 'dt', type: 'dimensions', dimensions: { height: 30, width: 90 } } as never,
      ]);
    });

    const stored = context.stateStore.getState().decisionGraph.nodes[0];
    expect(stored[privateSymbol]).toMatchObject({
      selected: true,
      dimensions: { height: 30, width: 90 },
    });
  });

  it('ignores no-op node changes without notifying listeners', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.handleNodesChange([{ id: 'missing-node', type: 'position', position: { x: 1, y: 1 } } as never]);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes edges through edge changes and notifies listeners', () => {
    context.stateStore.setState({
      decisionGraph: { nodes: [inputNode(), tableNode()], edges: [edge('e1', 'in', 'dt')] },
    });
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.handleEdgesChange([{ id: 'e1', type: 'remove' } as never]);
    });

    expect(context.stateStore.getState().decisionGraph.edges).toHaveLength(0);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not touch the graph for non-removal edge changes', () => {
    context.stateStore.setState({
      decisionGraph: { nodes: [inputNode(), tableNode()], edges: [edge('e1', 'in', 'dt')] },
    });
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.handleEdgesChange([{ id: 'e1', type: 'select', selected: true } as never]);
    });

    expect(context.stateStore.getState().decisionGraph.edges).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('manages tab lifecycle', () => {
    act(() => context.actions.openTab('dt'));
    expect(context.stateStore.getState()).toMatchObject({ openTabs: ['dt'], activeTab: 'dt' });

    act(() => context.actions.openTab('fn'));
    expect(context.stateStore.getState().activeTab).toBe('fn');

    act(() => context.actions.openTab('graph'));
    expect(context.stateStore.getState().activeTab).toBe('graph');

    act(() => context.actions.closeTab('fn'));
    const { openTabs, activeTab } = context.stateStore.getState();
    expect(openTabs).toEqual(['dt']);
    expect(activeTab).toBe('dt');
  });

  it('persists compact mode preference', () => {
    act(() => context.actions.setCompactMode(true));

    expect(context.stateStore.getState().compactMode).toBe(true);
    expect(localStorage.getItem('jdm-compact-mode')).toBe('true');
  });
});
