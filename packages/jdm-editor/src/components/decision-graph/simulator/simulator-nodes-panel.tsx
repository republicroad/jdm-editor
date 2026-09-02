import { CheckCircleTwoTone, ClearOutlined, CloseCircleTwoTone } from '@/icons';
import clsx from 'clsx';
import React, { useMemo } from 'react';
import { P, match } from 'ts-pattern';

import { useT } from '../../../theming/i18n';
import { Button, Spin, Tooltip, Typography } from '../../primitives';
import type { ViewConfig } from '../context/dg-store.context';
import { NodeKind } from '../nodes/specifications/specification-types';
import type { Simulation, SimulationTrace } from './simulation.types';

type SimulatorNodesPanelStatus = 'success' | 'error' | 'not-run';

export type SimulatorNodesPanelProps = {
  search?: string;
  onSearchChange: (search: string) => void;
  loading?: boolean;
  simulate?: Simulation;
  nodeTypes?: Record<string, string | undefined>;
  viewConfig?: ViewConfig;
  selectedNode: string;
  onSelectNode: (nodeId: string) => void;
  onClear?: () => void;
  onGoToNode: (nodeId: string) => void;
};

export const SimulatorNodesPanel: React.FC<SimulatorNodesPanelProps> = ({
  search,
  onSearchChange,
  loading = false,
  simulate,
  nodeTypes,
  viewConfig,
  selectedNode,
  onSelectNode,
  onClear,
  onGoToNode,
}) => {
  const t = useT();

  const traces = useMemo<Array<SimulationTrace & { nodeId: string }>>(() => {
    if (!simulate) {
      return [];
    }

    if (!('result' in simulate)) {
      return [];
    }

    return Object.entries(simulate.result?.trace ?? {})
      .filter(([id]) => (viewConfig?.enabled ? !!viewConfig?.permissions?.[id] : true))
      .map(([key, data]) => ({ ...data, nodeId: key }))
      .filter((trace) => ![NodeKind.Input].includes(nodeTypes?.[trace.nodeId] as NodeKind))
      .filter((trace) => trace.name.toLowerCase().includes(search?.toLowerCase() ?? ''))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [simulate, viewConfig, nodeTypes, search]);

  return (
    <React.Fragment>
      <div className='flex items-center justify-between gap-2 border-b border-border px-3 py-2'>
        <input
          className='h-7 w-full min-w-0 rounded-md border border-border bg-muted/40 px-2 text-xs outline-none focus:border-primary/50'
          type='text'
          placeholder={t('simulator.searchPlaceholder')}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <div className='flex shrink-0 items-center gap-1'>
          {onClear && (
            <Tooltip title={t('simulator.clear')} placement='bottomRight'>
              <Button size='small' type='text' icon={<ClearOutlined />} onClick={() => onClear?.()} />
            </Tooltip>
          )}
        </div>
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto p-2'>
        <Spin spinning={loading}>
          <div className='flex flex-col gap-0.5'>
            {!simulate && (
              <Typography.Text type='secondary' className='mt-14 block text-center' style={{ fontSize: 13 }}>
                {t('simulator.readyTitle')}
                <br />
                {t('simulator.readyHint')}
                <br />
                <Typography.Link
                  href='https://docs.gorules.io/docs/simulator'
                  target='_blank'
                  className='mt-1 inline-block'
                  style={{ fontSize: 13 }}
                >
                  {t('simulator.learnMore')}
                </Typography.Link>
              </Typography.Text>
            )}
            {'graph'.includes(search?.toLowerCase() ?? '') && simulate && (
              <div
                className={clsx(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60',
                  selectedNode === 'graph' && 'bg-primary/10',
                )}
                onClick={() => onSelectNode('graph')}
              >
                <Typography.Text data-role='name' className='min-w-0 items-center truncate'>
                  <StatusIcon
                    status={match(simulate)
                      .with({ error: P.nonNullable }, () => 'error' as const)
                      .with({ result: P.nonNullable }, () => 'success' as const)
                      .otherwise(() => 'not-run' as const)}
                  />
                  Graph
                </Typography.Text>
                <Typography.Text type='secondary' data-role='performance'>
                  {match(simulate)
                    .with({ result: P._ }, ({ result }) => result?.performance)
                    .otherwise(() => undefined)}
                </Typography.Text>
              </div>
            )}
            {traces.map((trace) => (
              <div
                key={trace.nodeId}
                className={clsx(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60',
                  trace.nodeId === selectedNode && 'bg-primary/10',
                )}
                onClick={() => onSelectNode(trace.nodeId)}
                onDoubleClick={() => onGoToNode(trace.nodeId)}
              >
                <Typography.Text data-role='name' className='min-w-0 truncate' title={trace.name}>
                  <StatusIcon status={trace.nodeId === simulate?.error?.data?.nodeId ? 'error' : 'success'} />
                  {trace.name}
                </Typography.Text>
                <Typography.Text type='secondary' data-role='performance'>
                  {trace.performance}
                </Typography.Text>
              </div>
            ))}
          </div>
        </Spin>
      </div>
    </React.Fragment>
  );
};

const StatusIcon: React.FC<{ status: SimulatorNodesPanelStatus }> = ({ status }) => {
  if (status === 'not-run') {
    return null;
  }

  if (status === 'success') {
    return (
      <CheckCircleTwoTone
        style={{ marginRight: 6, fontSize: 12, opacity: 0.5, color: 'var(--grl-color-success, #16a34a)' }}
      />
    );
  }

  return <CloseCircleTwoTone style={{ marginRight: 5, fontSize: 12, color: 'var(--grl-color-error, #dc2626)' }} />;
};
