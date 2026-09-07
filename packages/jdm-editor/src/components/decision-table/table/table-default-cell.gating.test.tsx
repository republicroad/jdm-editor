import { VariableType, initSync } from '@gorules/zen-engine-wasm';
import type { CellContext } from '@tanstack/react-table';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React, { useEffect } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type * as wasmHelpers from '../../../helpers/wasm';
import { DecisionTableProvider, useDecisionTableRaw } from '../context/dt-store.context';
import { TableDefaultCell } from './table-default-cell';

// The gating under test reads useWasmReady; drive it via this flag while the
// builders keep using the real wasm runtime initialized below.
const wasmState = vi.hoisted(() => ({ ready: true }));
vi.mock('../../../helpers/wasm', async (importOriginal) => {
  const actual = await importOriginal<typeof wasmHelpers>();
  return {
    ...actual,
    isWasmAvailable: () => wasmState.ready,
    useWasmReady: () => wasmState.ready,
  };
});

beforeAll(() => {
  initSync({
    module: readFileSync(resolve(process.cwd(), 'node_modules/@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm')),
  });
});

const COLUMN_ID = 'col-amount';

const BusinessStore: React.FC = () => {
  const { stateStore } = useDecisionTableRaw();
  useEffect(() => {
    stateStore.setState({
      mode: 'business',
      inputVariableType: VariableType.fromJson('Any'),
      decisionTable: {
        hitPolicy: 'first',
        inputs: [{ id: COLUMN_ID, name: 'Amount', field: 'amount', fieldType: { type: 'number' } }],
        outputs: [],
        rules: [{ id: 'r1', [COLUMN_ID]: '>= 1000' }],
      },
    } as never);
  }, []);
  return null;
};

const cellContext = {
  row: { index: 0 },
  column: { id: COLUMN_ID },
  table: { options: { meta: {} } },
} as unknown as CellContext<Record<string, string>, string>;

const renderCell = () => {
  const onChange = vi.fn();
  const view = render(
    <DecisionTableProvider>
      <BusinessStore />
      <TableDefaultCell context={cellContext} />
    </DecisionTableProvider>,
  );
  return { onChange, ...view };
};

describe('business-mode cell gating on wasm readiness', () => {
  it('renders the natural-language builder when wasm is ready', () => {
    wasmState.ready = true;
    const { container, unmount } = renderCell();

    // Typed control (number input) instead of a code cell; the lazy dev
    // highlighter (.grl-ce) must not appear.
    expect(container.querySelector('input')).not.toBeNull();
    expect(container.querySelector('.grl-ce')).toBeNull();
    unmount();
  });

  it('falls back to the dev CodeMirror cell until wasm is ready', () => {
    wasmState.ready = false;
    const { container, unmount } = renderCell();

    // Dev cells render the (lazy) highlighter/editor root, not builder controls.
    expect(container.querySelector('.grl-ce')).not.toBeNull();
    unmount();
  });
});
