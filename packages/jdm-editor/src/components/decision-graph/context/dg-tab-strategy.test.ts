import { describe, expect, it } from 'vitest';

import { applyCloseTab, applyOpenTab } from './dg-tab-strategy';

const TABS = ['t1', 't2', 't3'];

describe('applyOpenTab', () => {
  it('activates the reserved graph tab without touching the open list', () => {
    expect(applyOpenTab(TABS, 'graph')).toEqual({ activeTab: 'graph' });
  });

  it('activates an already-open tab in place', () => {
    expect(applyOpenTab(TABS, 't2')).toEqual({ activeTab: 't2' });
  });

  it('appends and activates an unseen tab', () => {
    expect(applyOpenTab(TABS, 't4')).toEqual({ openTabs: [...TABS, 't4'], activeTab: 't4' });
  });
});

describe('applyCloseTab', () => {
  it('closes a single tab and keeps the active one when it survives', () => {
    expect(applyCloseTab(TABS, 't3', 't1')).toEqual({ openTabs: ['t2', 't3'] });
  });

  it("falls back to the tab left of the closed position when the active tab is closed", () => {
    expect(applyCloseTab(TABS, 't3', 't3')).toEqual({ openTabs: ['t1', 't2'], activeTab: 't2' });
  });

  it("falls back to 'graph' when nothing remains on the left", () => {
    expect(applyCloseTab(['t1'], 't1', 't1')).toEqual({ openTabs: [], activeTab: 'graph' });
  });

  it('clears every tab on close-all', () => {
    expect(applyCloseTab(TABS, 't2', 't2', 'close-all')).toEqual({
      openTabs: [],
      activeTab: 'graph',
    });
  });

  it('keeps only the anchor tab on close-other while it stays active', () => {
    // Active tab survives → legacy code patches openTabs only.
    expect(applyCloseTab(TABS, 't2', 't2', 'close-other')).toEqual({
      openTabs: ['t2'],
    });
  });

  it('truncates to the anchor on close-right and re-resolves activation', () => {
    expect(applyCloseTab(TABS, 't2', 't2', 'close-right')).toEqual({
      openTabs: ['t1', 't2'],
    });
    // Active tab lived on the truncated side: legacy index fallback picks the
    // entry just left of the closed position inside the remaining list.
    expect(applyCloseTab(TABS, 't3', 't2', 'close-right')).toEqual({
      openTabs: ['t1', 't2'],
      activeTab: 't1',
    });
  });

  it('slices from the anchor onward on close-left', () => {
    expect(applyCloseTab(TABS, 't3', 't2', 'close-left')).toEqual({
      openTabs: ['t2', 't3'],
    });
    // Active tab lived on the removed left side; legacy fallback resolves to
    // updatedTabs[index - 1].
    expect(applyCloseTab(TABS, 't1', 't2', 'close-left')).toEqual({
      openTabs: ['t2', 't3'],
      activeTab: 't2',
    });
  });

  it('leaves state untouched for unknown actions when active survives', () => {
    expect(applyCloseTab(TABS, 't1', 't2', 'nonsense' as never)).toEqual({ openTabs: TABS });
  });
});
