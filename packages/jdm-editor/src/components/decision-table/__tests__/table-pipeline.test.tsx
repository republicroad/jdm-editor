import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CellContext } from '@tanstack/react-table';

import {
  DecisionTableProvider,
  useDecisionTableRaw,
  type DecisionTablePermission,
  type DecisionTableType,
} from '../context/dt-store.context';
import { TableDefaultCell } from '../table/table-default-cell';

let ctx: ReturnType<typeof useDecisionTableRaw> | null = null;

const Probe: React.FC = () => {
  ctx = useDecisionTableRaw();
  return null;
};

const baseTable = (): DecisionTableType => ({
  hitPolicy: 'first',
  // No column definitions → the cell takes the plain-textarea fallback
  // branch (TableInputCell), fully exercisable in jsdom without CodeMirror.
  inputs: [],
  outputs: [],
  rules: [
    { _id: 'r1', _description: '', 'in-a': '40', 'out-a': '40' },
    { _id: 'r2', _description: '', 'in-a': '60', 'out-a': '60' },
  ],
});

type Ctx = CellContext<Record<string, string>, string>;

const fakeContext = (): Ctx =>
  ({
    row: { index: 0 },
    column: { id: 'in-a' },
    table: { options: { meta: null } },
  }) as unknown as Ctx;

const mountCell = (permission?: DecisionTablePermission, opts: { disabled?: boolean } = {}) => {
  render(
    <DecisionTableProvider>
      <Probe />
      <TableDefaultCell context={fakeContext()} onChange={undefined} />
    </DecisionTableProvider>,
  );

  act(() => {
    ctx!.stateStore.setState({
      decisionTable: baseTable(),
      permission,
      disabled: opts.disabled ?? false,
      inputsSchema: undefined,
      outputsSchema: undefined,
    });
  });
};

const editor = (editable: boolean) =>
  document.querySelector<HTMLElement>(
    `[data-cell-wrapper] .grl-textarea-input[contenteditable="${editable}"]`,
  );

/**
 * jsdom + React 19 event delegation does not deliver synthesized `input`
 * events to contentEditable handlers reliably, so we invoke the attached
 * React onInput handler directly — still exercising the real handler →
 * commit → immer store pipeline end-to-end.
 */
const typeInto = (el: HTMLElement, text: string) => {
  const reactPropsKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  const props = reactPropsKey
    ? (el as never as Record<string, Record<string, unknown>>)[reactPropsKey]
    : undefined;
  const onInput = props?.onInput as ((e: unknown) => void) | undefined;
  expect(onInput).toBeTypeOf('function');

  act(() => {
    el.textContent = text;
    onInput!({ currentTarget: { textContent: text } });
  });
};

beforeEach(() => {
  ctx = null;
});

describe('decision-table cell editing pipeline', () => {
  it('commits typed content from the cell editor into store rules', () => {
    mountCell('edit:full');

    const el = editor(true)!;
    expect(el).toBeTruthy();

    typeInto(el, 'hello');

    expect(ctx!.stateStore.getState().decisionTable.rules[0]['in-a']).toBe('hello');
    // Sibling rows/columns untouched.
    expect(ctx!.stateStore.getState().decisionTable.rules[1]['in-a']).toBe('60');
    expect(ctx!.stateStore.getState().decisionTable.rules[0]['out-a']).toBe('40');
  });

  it('focus on the cell wrapper records the store cursor', () => {
    mountCell('edit:full');

    const wrapper = document.querySelector<HTMLElement>('[data-cell-wrapper]')!;
    act(() => {
      fireEvent.focus(wrapper);
    });

    expect(ctx!.stateStore.getState().cursor).toEqual({ x: 'in-a', y: 0 });
  });

  it('renders non-editable cells when the table is disabled', () => {
    mountCell('edit:full', { disabled: true });

    expect(editor(true)).toBeNull();
    expect(editor(false)).toBeTruthy();
    expect(ctx!.stateStore.getState().decisionTable.rules[0]['in-a']).toBe('40');
  });

  it('commitData writes through immer to the seeded rules', () => {
    mountCell('edit:full');

    act(() => {
      ctx!.actions.commitData('hello', { x: 'in-a', y: 0 });
    });

    expect(ctx!.stateStore.getState().decisionTable.rules[0]['in-a']).toBe('hello');
    expect(ctx!.stateStore.getState().decisionTable.rules[1]['in-a']).toBe('60');
  });
});
