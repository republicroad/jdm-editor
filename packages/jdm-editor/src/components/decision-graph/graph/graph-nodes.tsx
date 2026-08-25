import { CloseOutlined, SearchOutlined } from '@/icons';
import { Avatar, Button, Input, Space, Typography } from '../../primitives';
import clsx from 'clsx';
import React, { useMemo, useState } from 'react';
import { match } from 'ts-pattern';

import { useDecisionGraphActions, useDecisionGraphListeners, useDecisionGraphState } from '../context/dg-store.context';
import { type DecisionNode } from '../dg-types';
import { NodeColor } from '../nodes/specifications/colors';
import { NodeKind } from '../nodes/specifications/specification-types';
import { nodeSpecification } from '../nodes/specifications/specifications';

const { Title, Text } = Typography;

export type GraphComponentsProps = {
  className?: string;
};

export const GraphNodes: React.FC<GraphComponentsProps> = React.memo(({ className }) => {
  const { decisionGraph, customComponents, viewConfig, viewConfigCta } = useDecisionGraphState((store) => ({
    decisionGraph: store.decisionGraph || [],
    customComponents: store.components,
    activeTabId: store.activeTab,
    viewConfig: store.viewConfig,
    viewConfigCta: store.viewConfigCta,
  }));

  const { openTab } = useDecisionGraphActions();
  const onViewConfigCta = useDecisionGraphListeners((s) => s.onViewConfigCta);

  const nodes = useMemo(() => {
    return (decisionGraph?.nodes || [])
      .filter((node) => (viewConfig?.enabled ? !!viewConfig?.permissions?.[node.id] : true))
      .map((node) => {
        const kind = node.type as NodeKind;
        const specification =
          nodeSpecification[node.type as NodeKind] || (customComponents || []).find((cmp) => cmp.type === node.type);

        return {
          id: node.id,
          type: node.type,
          name: node.name,
          disabled: match(kind)
            .with(NodeKind.Function, () => false)
            .with(NodeKind.DecisionTable, () => false)
            .with(NodeKind.Expression, () => false)
            .otherwise(() => true),
          position: node.position,
          icon: specification?.icon,
          ...(node?._diff ? { _diff: node._diff } : {}),
        };
      });
  }, [decisionGraph, viewConfig]);

  const [search, setSearch] = useState('');

  const ConfigItem = ({ node }: { node: DecisionNode }) => {
    const specification = nodeSpecification?.[node?.type as NodeKind];

    return (
      <div
        className={clsx(
          'cursor-pointer rounded-(--grl-border-radius) border bg-card text-card-foreground shadow-xs transition-colors hover:border-primary/50',
          node?._diff?.status,
        )}
        onClick={() => openTab(node.id)}
      >
        <div className='p-4'>
          <div className={'flex items-center gap-3'}>
            <Avatar
              size={24}
              shape='square'
              style={{
                background: specification?.color || NodeColor.Blue,
                fontSize: 16,
                lineHeight: '22px',
                borderRadius: 3,
              }}
              icon={specification?.icon}
            />
            <div style={{ flex: 1 }}>
              <Text style={{ margin: 0, fontSize: 14, marginBottom: node?.description ? '4px' : 0 }}>{node.name}</Text>
              {node?.description && (
                <Text type='secondary' style={{ fontSize: '14px' }}>
                  {node?.description}
                </Text>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const nodeGroups = useMemo(() => {
    const filtered = nodes.filter((node) =>
      search.trim()?.length > 0 ? node.name?.toLowerCase?.()?.indexOf?.(search?.trim?.()?.toLowerCase?.()) > -1 : true,
    );

    return [
      {
        title: 'Decision Tables',
        nodes: filtered.filter((node) => node.type === NodeKind.DecisionTable),
      },
      {
        title: 'Expressions',
        nodes: filtered.filter((node) => node.type === NodeKind.Expression),
      },
      {
        title: 'Functions',
        nodes: filtered.filter((node) => node.type === NodeKind.Function),
      },
    ];
  }, [search, nodes]);

  const isEmpty = (nodes?.length || 0) === 0;

  return (
    <div
      className={clsx([
        'relative hidden h-full w-full flex-1 min-h-0 overflow-y-auto bg-[var(--grl-color-bg-layout)] p-6 outline-none focus:outline-none focus-within:outline-none',
        className,
      ])}
    >
      <div className={'mx-auto w-full max-w-[1200px]'}>
        <div className={'mb-8'}>
          <div className={'flex justify-between'}>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
              {isEmpty ? 'Decision View Not Configured' : 'Decision View'}
            </Title>
            {viewConfigCta && (
              <Button
                type={'primary'}
                onClick={() => {
                  onViewConfigCta?.();
                }}
              >
                {viewConfigCta}
              </Button>
            )}
          </div>
          {!isEmpty ? (
            <Text type='secondary'>
              {viewConfig?.description || 'Configure business rules for your decision model'}
            </Text>
          ) : (
            <>
              {decisionGraph?.nodes?.length > 0 ? (
                <Text type='secondary'>
                  This decision model contains multiple components, but no view has been configured yet.
                </Text>
              ) : (
                <Text type='secondary'>{`This decision model doesn't contain any component.`}</Text>
              )}
            </>
          )}
        </div>

        {!isEmpty && (
          <div className={'flex items-center justify-between mb-8'}>
            <Space>
              <Input
                placeholder='Search nodes'
                prefix={<SearchOutlined />}
                style={{ width: 350 }}
                onChange={(e) => setSearch(e.target.value)}
                value={search}
              />
              {search?.trim()?.length > 0 && (
                <Button type='text' size={'small'} icon={<CloseOutlined />} onClick={() => setSearch('')}>
                  Clear
                </Button>
              )}
            </Space>
            <Text
              type='secondary'
              style={{
                whiteSpace: 'nowrap',
              }}
            >
              {nodes?.length || 0} configurable items
            </Text>
          </div>
        )}

        {nodeGroups
          .filter((group) => group?.nodes?.length > 0)
          .map((group) => (
            <div key={group.title} className={'mb-8'}>
              <Title level={5} style={{ marginBottom: '16px' }}>
                {group.title}
              </Title>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'>
                {group.nodes.map((node) => (
                  <ConfigItem key={node.id} node={node} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
});
