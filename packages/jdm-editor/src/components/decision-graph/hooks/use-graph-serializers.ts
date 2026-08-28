import type { ReactFlowInstance, Viewport } from '@xyflow/react';
import type { MutableRefObject } from 'react';

import type { DecisionGraphStoreType, ExposedStore } from '../context/dg-store.context';
import { useGraphSerializer } from '../context/serializer.context';

type TabsSlice = { openTabs: string[]; activeTab: string };

export const componentsOpenedKey = 'jdm-components-opened';

/**
 * Registers the graph-level persistence slices (viewport, open tabs,
 * components-panel visibility) with the serializer registry.
 */
export const useGraphSerializers = ({
  reactFlowInstance,
  onRestoreViewport,
  stateStore,
  componentsOpened,
  setComponentsOpened,
}: {
  reactFlowInstance: MutableRefObject<ReactFlowInstance | null>;
  onRestoreViewport: (viewport: Viewport) => void;
  stateStore: ExposedStore<DecisionGraphStoreType['state']>;
  componentsOpened: boolean;
  setComponentsOpened: (value: boolean) => void;
}) => {
  useGraphSerializer<Viewport>('viewport', {
    serialize: () => reactFlowInstance.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 },
    restore: (viewport) => {
      if (!viewport) return;
      onRestoreViewport(viewport);
      reactFlowInstance.current?.setViewport(viewport);
    },
  });

  useGraphSerializer<TabsSlice>('tabs', {
    serialize: () => {
      const { openTabs, activeTab } = stateStore.getState();
      return { openTabs, activeTab };
    },
    restore: ({ openTabs, activeTab } = { openTabs: [], activeTab: 'graph' }) => {
      stateStore.setState({ openTabs: openTabs ?? [], activeTab: activeTab ?? 'graph' });
    },
  });

  useGraphSerializer<boolean>('componentsOpened', {
    serialize: () => componentsOpened,
    restore: (value) => {
      if (typeof value !== 'boolean') return;
      setComponentsOpened(value);
      localStorage.setItem(componentsOpenedKey, `${value}`);
    },
  });
};
