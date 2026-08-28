import { act, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DecisionTableProvider,
  type DecisionTableType,
  type TableSchemaItem,
  parseDecisionTable,
  useDecisionTableRaw,
} from '../context/dt-store.context';

type ContextValue = ReturnType<typeof useDecisionTableRaw>;

let ctx: ContextValue | null = null;

const Probe: React.FC = () => {
  ctx = useDecisionTableRaw();
  return null;
};

const renderProvider = () => {
  render(
    <DecisionTableProvider>
      <Probe />
    </DecisionTableProvider>,
  );
  if (!ctx) {
    throw new Error('provider context was not captured');
  }
  return ctx;
};

const inputCol = (id: string, extra: Partial<TableSchemaItem> = {}): TableSchemaItem => ({
  id,
  name: id,
  ...extra,
});

const outputCol = (id: string, extra: Partial<TableSchemaItem> = {}): TableSchemaItem => ({
  id,
  name: id,
  field: id,
  ...extra,
});

const baseTable = (): DecisionTableType => ({
  hitPolicy: 'first',
  inputs: [inputCol('in-a'), inputCol('in-b')],
  outputs: [outputCol('out-a')],
  rules: [
    { '_id': 'r1', '_description': '', 'in-a': '40', 'in-b': '"US"', 'out-a': '40' },
    { '_id': 'r2', '_description': '', 'in-a': '60', 'in-b': '"DE"', 'out-a': '60' },
  ],
});

describe('parseDecisionTable', () => {
  it('seeds defaults for an empty table', () => {
    const parsed = parseDecisionTable();

    expect(parsed.hitPolicy).toBe('first');
    expect(parsed.passThrough).toBe(false);
    expect(parsed.executionMode).toBe('single');
    expect(parsed.inputs).toHaveLength(1);
    expect(parsed.inputs[0].name).toBe('Input');
    expect(parsed.outputs).toHaveLength(1);
    expect(parsed.outputs[0]).toMatchObject({ field: 'output', name: 'Output' });
    expect(parsed.rules).toEqual([]);
  });

  it('backfills missing rule ids while preserving valid ones', () => {
    const parsed = parseDecisionTable({
      hitPolicy: 'first',
      inputs: [],
      outputs: [],
      rules: [{ _id: 'keep-me' }, {}, { _id: '' }],
    });

    expect(parsed.rules[0]._id).toBe('keep-me');
    expect(parsed.rules[1]._id).toBeTruthy();
    expect(parsed.rules[2]._id).toBeTruthy();
    expect(new Set(parsed.rules.map((r) => r._id)).size).toBe(3);
  });

  it('carries diff metadata through parsing', () => {
    const diff = { created: true } as never;
    const parsed = parseDecisionTable({
      hitPolicy: 'first',
      inputs: [],
      outputs: [],
      rules: [],
      _diff: diff,
    });

    expect(parsed._diff).toBe(diff);
  });
});

describe('decision table store actions', () => {
  let context: ContextValue;

  beforeEach(() => {
    context = renderProvider();
    act(() => {
      context.actions.setDecisionTable(baseTable());
      context.listenerStore.setState({ onChange: undefined, cellRenderer: undefined });
    });
  });

  it('commits a value to the exact cursor cell and notifies listeners', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.commitData('99', { x: 'in-a', y: 1 });
    });

    const state = context.stateStore.getState();
    expect(state.decisionTable.rules[1]['in-a']).toBe('99');
    expect(state.decisionTable.rules[0]['in-a']).toBe('40');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(state.decisionTable);
  });

  it('swaps rows, resets the cursor and notifies listeners', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });
    act(() => {
      context.actions.setCursor({ x: 'in-a', y: 0 });
    });

    act(() => {
      context.actions.swapRows(0, 1);
    });

    const state = context.stateStore.getState();
    expect(state.decisionTable.rules.map((rule) => rule._id)).toEqual(['r2', 'r1']);
    expect(state.cursor).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('adds a row above with schema-driven default cells', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });
    act(() => {
      context.actions.setDecisionTable({
        ...baseTable(),
        inputs: [inputCol('in-a', { defaultValue: '7' })],
        outputs: [outputCol('out-a', { outputFieldType: { type: 'number' } as never })],
        rules: [],
      });
    });

    act(() => {
      context.actions.addRowAbove();
    });

    const [added] = context.stateStore.getState().decisionTable.rules;
    expect(context.stateStore.getState().decisionTable.rules).toHaveLength(1);
    expect(added['in-a']).toBe('7');
    expect(added['out-a']).toBe('0');
    expect(added._id).toBeTruthy();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('inserts an explicit addRowAbove target between existing rows', () => {
    act(() => {
      context.actions.addRowAbove(1);
    });

    const rules = context.stateStore.getState().decisionTable.rules;
    expect(rules).toHaveLength(3);
    expect(rules[1]._id).not.toBe('r1');
    expect(rules[1]._id).not.toBe('r2');
    expect(rules[0]._id).toBe('r1');
    expect(rules[2]._id).toBe('r2');
    expect(rules[1]['in-a']).toBe('');
  });

  it('shifts the cursor down when inserting above its row', () => {
    act(() => {
      context.actions.setCursor({ x: 'out-a', y: 0 });
    });

    act(() => {
      context.actions.addRowAbove(0);
    });

    expect(context.stateStore.getState().cursor).toEqual({ x: 'out-a', y: 1 });
  });

  it('leaves the cursor untouched when inserting above another row', () => {
    act(() => {
      context.actions.setCursor({ x: 'out-a', y: 1 });
    });

    act(() => {
      context.actions.addRowAbove(0);
    });

    expect(context.stateStore.getState().cursor).toEqual({ x: 'out-a', y: 1 });
  });

  it('appends a row below at the end by default and after an explicit target', () => {
    act(() => {
      context.actions.addRowBelow();
    });
    let rules = context.stateStore.getState().decisionTable.rules;
    expect(rules).toHaveLength(3);
    expect(rules[2]._id).not.toBe('r1');
    expect(rules[2]._id).not.toBe('r2');

    act(() => {
      context.actions.addRowBelow(0);
    });
    rules = context.stateStore.getState().decisionTable.rules;
    expect(rules).toHaveLength(4);
    expect(rules[1]._id).not.toBe('r1');
    expect(rules[1]._id).not.toBe('r2');
  });

  it('shifts the cursor up when adding below its row', () => {
    act(() => {
      context.actions.setCursor({ x: 'in-a', y: 1 });
    });

    act(() => {
      context.actions.addRowBelow(0);
    });

    expect(context.stateStore.getState().cursor).toEqual({ x: 'in-a', y: 0 });
  });

  it('removes the requested row and notifies listeners', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.removeRow(0);
    });

    const rules = context.stateStore.getState().decisionTable.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]._id).toBe('r2');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('maps fresh-row defaults for every output field type', () => {
    act(() => {
      context.actions.setDecisionTable({
        hitPolicy: 'first',
        inputs: [],
        outputs: [
          outputCol('out-str', { outputFieldType: { type: 'string' } as never }),
          outputCol('out-arr', { outputFieldType: { type: 'string-array' } as never }),
          outputCol('out-bool', { outputFieldType: { type: 'boolean' } as never }),
          outputCol('out-date', { outputFieldType: { type: 'date' } as never }),
          outputCol('out-num', {
            defaultValue: '42',
            outputFieldType: { type: 'number' } as never,
          }),
        ],
        rules: [],
      });
    });

    act(() => {
      context.actions.addRowAbove();
    });

    const [added] = context.stateStore.getState().decisionTable.rules;
    expect(added['out-str']).toBe('""');
    expect(added['out-arr']).toBe('[]');
    expect(added['out-bool']).toBe('false');
    expect(added['out-date']).toMatch(/^d\('/);
    expect(added['out-num']).toBe('42');
  });

  it('adds a column and backfills blank cells while keeping values', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.addColumn('inputs', inputCol('in-new'));
    });

    const state = context.stateStore.getState();
    expect(state.decisionTable.inputs.map((column) => column.id)).toEqual(['in-a', 'in-b', 'in-new']);
    expect(state.decisionTable.rules[0]).toMatchObject({ 'in-a': '40', 'in-new': '' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('updates a column in place and preserves rule data', () => {
    act(() => {
      context.actions.updateColumn('outputs', 'out-a', {
        id: 'out-a',
        name: 'Renamed',
        field: 'renamed',
        outputFieldType: { type: 'string' } as never,
      });
    });

    const state = context.stateStore.getState();
    expect(state.decisionTable.outputs[0]).toMatchObject({ id: 'out-a', name: 'Renamed', field: 'renamed' });
    expect(state.decisionTable.rules[0]['out-a']).toBe('40');
  });

  it('removes a column, prunes rule cells and clears the cursor', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });
    act(() => {
      context.actions.setCursor({ x: 'in-a', y: 0 });
    });

    act(() => {
      context.actions.removeColumn('inputs', 'in-a');
    });

    const state = context.stateStore.getState();
    expect(state.decisionTable.inputs.map((column) => column.id)).toEqual(['in-b']);
    expect(state.decisionTable.rules[0]).not.toHaveProperty('in-a');
    expect(state.cursor).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('re-seeds a default input column when the last input is removed', () => {
    act(() => {
      context.actions.removeColumn('inputs', 'in-a');
      context.actions.removeColumn('inputs', 'in-b');
    });

    const inputs = context.stateStore.getState().decisionTable.inputs;
    expect(inputs).toHaveLength(1);
    expect(inputs[0].name).toBe('Input');
    expect(inputs[0].id).not.toBe('in-a');
  });

  it('reorders columns without disturbing per-id rule values', () => {
    act(() => {
      context.actions.reorderColumns('inputs', [inputCol('in-b'), inputCol('in-a')]);
    });

    const state = context.stateStore.getState();
    expect(state.decisionTable.inputs.map((column) => column.id)).toEqual(['in-b', 'in-a']);
    expect(state.decisionTable.rules[0]).toMatchObject({ 'in-a': '40', 'in-b': '"US"' });
  });

  it('switches the hit policy and notifies listeners', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.updateHitPolicy('collect');
    });

    expect(context.stateStore.getState().decisionTable.hitPolicy).toBe('collect');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps setDecisionTable and setCursor silent for listeners', () => {
    const onChange = vi.fn();
    context.listenerStore.setState({ onChange });

    act(() => {
      context.actions.setDecisionTable(baseTable());
      context.actions.setCursor({ x: 'in-a', y: 0 });
    });

    expect(context.stateStore.getState().cursor).toEqual({ x: 'in-a', y: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
