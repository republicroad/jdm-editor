import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ExpressionEntry } from '../expression-store.context';
import { ExpressionStoreProvider, useExpressionStoreRaw } from '../expression-store.context';

const entry = (id: string, key: string, value = ''): ExpressionEntry => ({
  id,
  key,
  value,
  type: undefined,
});

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <ExpressionStoreProvider>{children}</ExpressionStoreProvider>
);

const useTestStore = () => renderHook(() => useExpressionStoreRaw(), { wrapper }).result.current;

describe('expression store', () => {
  let store: ReturnType<typeof useExpressionStoreRaw>;

  beforeEach(() => {
    store = useTestStore();
    store.setState({
      expressions: [entry('e1', 'weight', '$.cart.weight'), entry('e2', 'country', '$.customer.country')],
    });
  });

  it('boots with an empty expressions list', () => {
    const fresh = renderHook(() => useExpressionStoreRaw(), { wrapper }).result.current;
    expect(fresh.getState().expressions).toEqual([]);
    expect(fresh.getState().debugIndex).toBe(0);
    expect(fresh.getState().disabled).toBe(false);
  });

  it('setExpressions replaces the list', () => {
    act(() => store.getState().setExpressions([entry('x1', 'only', '1')]));
    expect(store.getState().expressions).toHaveLength(1);
    expect(store.getState().expressions[0].key).toBe('only');
  });

  it('addRowAbove inserts a blank row at the index', () => {
    act(() => store.getState().addRowAbove(0));
    expect(store.getState().expressions).toHaveLength(3);
    expect(store.getState().expressions[0].key).toBe('');
    expect(store.getState().expressions[1].key).toBe('weight');
  });

  it('addRowBelow appends after the index (default: end of list)', () => {
    act(() => store.getState().addRowBelow());
    expect(store.getState().expressions).toHaveLength(3);
    expect(store.getState().expressions[2].key).toBe('');
  });

  it('removeRow deletes by index', () => {
    act(() => store.getState().removeRow(0));
    expect(store.getState().expressions.map((e) => e.key)).toEqual(['country']);
  });

  it('swapRows exchanges row positions', () => {
    act(() => store.getState().swapRows(0, 1));
    expect(store.getState().expressions.map((e) => e.key)).toEqual(['country', 'weight']);
  });

  it('updateRow merges fields and keeps the row identity', () => {
    act(() => store.getState().updateRow(0, { key: 'renamed', value: '$.x' }));
    const row = store.getState().expressions[0];
    expect(row.id).toBe('e1');
    expect(row.key).toBe('renamed');
    expect(row.value).toBe('$.x');
  });

  it('generateEntry ids are unique', () => {
    act(() => {
      store.getState().addRowBelow();
      store.getState().addRowBelow();
    });
    const ids = store.getState().expressions.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
