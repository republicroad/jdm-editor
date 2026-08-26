import type { DecisionGraphStoreType } from './dg-store.context';

type StateSlice = Partial<Pick<DecisionGraphStoreType['state'], 'openTabs' | 'activeTab'>>;

/** Tab id reserved for the graph canvas itself. */
export const GRAPH_TAB_ID = 'graph';

/**
 * Resolve the state patch for activating a tab: 'graph' always activates;
 * an already-open tab just becomes active; otherwise it is appended and
 * activated.
 */
export const applyOpenTab = (openTabs: string[], id: string): StateSlice => {
  if (id === GRAPH_TAB_ID) {
    return { activeTab: GRAPH_TAB_ID };
  }

  if (openTabs.includes(id)) {
    return { activeTab: id };
  }

  return { openTabs: [...openTabs, id], activeTab: id };
};

/**
 * Resolve the state patch for closing a tab. Supported actions mirror the
 * context menu: close (single), close-all, close-other, close-right,
 * close-left. When the previously active tab no longer exists after the
 * operation, activation falls back to the tab left of the closed position
 * (verbatim legacy behaviour, including its index-based quirk) or to
 * 'graph'.
 */
export const applyCloseTab = (
  openTabs: string[],
  activeTab: string,
  id: string,
  action?: string,
): StateSlice => {
  const index = openTabs?.findIndex((i) => i === id);
  const tab = openTabs?.[index];

  const updatedTabs = matchAction(openTabs, action, tab, index);

  const updatedState: StateSlice = {
    openTabs: updatedTabs,
  };

  const newActiveTabId = updatedTabs?.find((i) => i === activeTab);
  if (!newActiveTabId) {
    updatedState.activeTab = updatedTabs?.[index - 1] ?? 'graph';
  }

  return updatedState;
};

const matchAction = (openTabs: string[], action: string | undefined, tab: string | undefined, index: number): string[] => {
  switch (action) {
    case undefined:
    case 'close':
      return openTabs.filter((openId) => openId !== tab);
    case 'close-all':
      return [];
    case 'close-other':
      return openTabs.filter((openId) => openId === tab);
    case 'close-right':
      return openTabs.slice(0, index + 1);
    case 'close-left':
      return openTabs.slice(index);
    default:
      return openTabs;
  }
};
