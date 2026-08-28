import { act, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type ExpressionEntry,
  ExpressionStoreProvider,
  createExpression,
  useExpressionStoreRaw,
} from '../context/expression-store.context';

type Store = ReturnType<typeof useExpressionStoreRaw>;

let storeRef: Store | null = null;

const Probe: React.FC = () => {
  storeRef = useExpressionStoreRaw();
  return null;
};

const renderProvider = () => {
  render(
    <ExpressionStoreProvider>
      <Probe />
    </ExpressionStoreProvider>,
  );
  if (!storeRef) {
    throw new Error('provider context was not captured');
  }
  return storeRef;
};

const entry = (id: string, key = '', value = ''): ExpressionEntry => ({ id, key, value });

describe('createExpression', () => {
  it('creates a blank entry with a generated id', () => {
    const created = createExpression();

    expect(created.id).toBeTruthy();
    expect(created.key).toBe('');
    expect(created.value).toBe('');
  });

  it('lets callers override defaults', () => {
    expect(createExpression({ key: 'customer.age', value: '18' })).toMatchObject({
      key: 'customer.age',
      value: '18',
    });
  });
});

describe('expression store actions', () => {
  let store: Store;

  beforeEach(() => {
    store = renderProvider();
    act(() => {
      store.getState().setExpressions([entry('e1', 'a', '1'), entry('e2', 'b', '2')]);
    });
  });

  it('replaces the whole expression list', () => {
    act(() => {
      store.getState().setExpressions([entry('only', 'k', 'v')]);
    });

    const expressions = store.getState().expressions;
    expect(expressions).toHaveLength(1);
    expect(expressions[0]).toMatchObject({ id: 'only', key: 'k', value: 'v' });
  });

  it('adds a row above at the front by default', () => {
    act(() => {
      store.getState().addRowAbove();
    });

    const expressions = store.getState().expressions;
    expect(expressions).toHaveLength(3);
    expect(expressions[0]).toMatchObject({ id: expressions[0].id, key: '', value: '' });
    expect(expressions[0].id).not.toBe('e1');
    expect(expressions.slice(1).map((row) => row.id)).toEqual(['e1', 'e2']);
  });

  it('adds a row above an explicit index', () => {
    act(() => {
      store.getState().addRowAbove(1);
    });

    expect(store.getState().expressions.map((row) => row.id)).toEqual(['e1', expect.any(String), 'e2']);
  });

  it('adds a row below at the end by default and after an explicit index', () => {
    act(() => {
      store.getState().addRowBelow();
    });
    let expressions = store.getState().expressions;
    expect(expressions).toHaveLength(3);
    expect(expressions[2].id).not.toBe('e1');
    expect(expressions[2].id).not.toBe('e2');

    act(() => {
      store.getState().addRowBelow(0);
    });
    expressions = store.getState().expressions;
    expect(expressions.map((row) => row.id)).toEqual(['e1', expect.any(String), 'e2', expect.any(String)]);
  });

  it('swaps rows by index', () => {
    act(() => {
      store.getState().swapRows(0, 1);
    });

    expect(store.getState().expressions.map((row) => row.id)).toEqual(['e2', 'e1']);
  });

  it('merges partial updates while preserving untouched fields', () => {
    act(() => {
      store.getState().updateRow(1, { key: 'renamed', value: '"x"' });
    });

    expect(store.getState().expressions[1]).toMatchObject({ id: 'e2', key: 'renamed', value: '"x"' });
  });

  it('removes the requested row', () => {
    act(() => {
      store.getState().removeRow(0);
    });

    expect(store.getState().expressions.map((row) => row.id)).toEqual(['e2']);
  });

  it('generates unique ids for rows created in bulk', () => {
    act(() => {
      store.getState().setExpressions([]);
      store.getState().addRowBelow();
      store.getState().addRowBelow();
      store.getState().addRowBelow();
    });

    const ids = store.getState().expressions.map((row) => row.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });
});
