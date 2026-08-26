import { CloseOutlined, DeploymentUnitOutlined, UnorderedListOutlined } from '@/icons';
import type { TabsProps } from '../../primitives';
import { Avatar, Button, Dropdown, Tabs } from '../../primitives';
import clsx from 'clsx';
import React, { useMemo } from 'react';

import { DiffIcon } from '../../diff-icon';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import type { DiffStatus } from '../dg-types';
import { NodeColor } from '../nodes/specifications/colors';
import type { NodeKind } from '../nodes/specifications/specification-types';
import { nodeSpecification } from '../nodes/specifications/specifications';

export type GraphTabsProps = {
  disabled?: boolean;
  tabBarExtraContent?: TabsProps['tabBarExtraContent'];
};

type NonUndefined<T> = T extends undefined ? never : T;
type TabItem = NonUndefined<TabsProps['items']>[number];

export const GraphTabs: React.FC<GraphTabsProps> = ({ disabled, tabBarExtraContent }) => {
  const graphActions = useDecisionGraphActions();
  const { openNodes, activeNodeId, viewConfig } = useDecisionGraphState(
    ({ decisionGraph, activeTab, openTabs, viewConfig }) => ({
      activeNodeId: (decisionGraph?.nodes ?? []).find((node) => node.id === activeTab)?.id,
      openNodes: (openTabs || [])
        .map((tab) => {
          const node = (decisionGraph?.nodes ?? []).find((node) => node.id === tab);
          if (!node) return undefined;
          return {
            id: node?.id,
            name: node.name,
            type: node.type,
            diff: node?._diff,
          };
        })
        .filter((node) => !!node),
      viewConfig,
    }),
  );

  const defaultItems = useMemo(() => {
    return [
      {
        key: 'graph',
        label: (
          <TabLabel
            total={openNodes?.length}
            icon={viewConfig?.enabled ? <UnorderedListOutlined /> : <DeploymentUnitOutlined />}
            name={viewConfig?.enabled ? 'Nodes' : 'Graph'}
            active={!activeNodeId || activeNodeId === 'graph'}
          />
        ),
      },
    ];
  }, [viewConfig, openNodes, activeNodeId]);

  return (
    <div>
      <Tabs
        type='line'
        size='small'
        className={clsx(
          'max-w-full [box-sizing:content-box] border-b border-b-[var(--grl-color-border)] bg-[var(--grl-color-bg-container)]',
          '[&_[role=tablist]]:m-0',
        )}
        activeKey={activeNodeId || 'graph'}
        onChange={(val) => graphActions.openTab(val)}
        tabBarExtraContent={tabBarExtraContent}
        items={[
          ...defaultItems,
          ...openNodes.map((node, index) => {
            const specification = nodeSpecification[node.type as NodeKind];

            return {
              disabled,
              key: node.id,
              label: (
                <TabLabel
                  onContextClick={(action) => {
                    graphActions.closeTab(node.id, action);
                  }}
                  icon={specification?.icon}
                  name={node?.name ?? node?.type}
                  diffStatus={node?.diff?.status}
                  color={specification?.color}
                  index={index}
                  active={node.id === activeNodeId}
                  total={openNodes?.length}
                  onClose={() => graphActions.closeTab(node.id)}
                />
              ),
            } satisfies TabItem;
          }),
        ]}
      />
    </div>
  );
};

const TabLabel: React.FC<{
  index?: number;
  total?: number;
  icon?: React.ReactNode;
  name?: string;
  color?: string;
  diffStatus?: string;
  onClose?: () => void;
  active?: boolean;
  onContextClick?: (action: string) => void;
}> = ({ total = 0, index = -1, icon, name, active, diffStatus, color = NodeColor.Blue, onClose, onContextClick }) => {
  const items = [
    total > 0 &&
      index !== -1 && {
        key: 'close',
        label: 'Close',
        onClick: () => onContextClick?.('close'),
      },
    total > 0 &&
      index !== -1 && {
        key: 'close-all',
        label: 'Close all Tabs',
        onClick: () => onContextClick?.('close-all'),
      },
    total > 0 &&
      index !== -1 && {
        key: 'close-other',
        label: 'Close other Tabs',
        onClick: () => onContextClick?.('close-other'),
      },
    total > 0 &&
      index + 1 < total && {
        key: 'close-right',
        label: 'Close Tabs to the right',
        onClick: () => onContextClick?.('close-right'),
      },
    total > 0 &&
      index > 0 && {
        key: 'close-left',
        label: 'Close Tabs to the left',
        onClick: () => onContextClick?.('close-left'),
      },
  ].filter((item) => !!item);

  const content = (
    <div
      className='group/tab flex items-center gap-1.5 px-3 py-[9px] transition-opacity duration-100 ease-in data-[active=false]:opacity-75 hover:opacity-100'
      data-active={active}
    >
      <Avatar
        size='small'
        shape='square'
        style={{
          background: color,
          fontSize: 11,
          width: 18,
          height: 18,
          lineHeight: '18px',
          borderRadius: 3,
        }}
        icon={icon}
      />
      {name}
      <DiffIcon
        status={diffStatus as DiffStatus}
        style={{
          fontSize: 16,
        }}
      />
      {onClose && (
        <Button
          className='opacity-0 transition-opacity duration-100 ease-in group-hover/tab:opacity-100! group-data-[active=true]/tab:opacity-100!'
          type='text'
          size='small'
          style={{ height: 20, width: 20, color: 'black', borderRadius: '50%', lineHeight: 0 }}
          icon={<CloseOutlined style={{ fontSize: 10 }} />}
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
        />
      )}
    </div>
  );

  // No context actions (e.g. the reserved Graph tab) → no menu wrapper at all.
  if (!onContextClick || items.length === 0) {
    return content;
  }

  return (
    <Dropdown menu={{ items }} trigger={['contextMenu']}>
      {content}
    </Dropdown>
  );
};
