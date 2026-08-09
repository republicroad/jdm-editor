import { CheckCircleTwoTone, ClearOutlined, CloseCircleTwoTone } from '@ant-design/icons';
import { Button, Spin, Tooltip, Typography } from 'antd';
import clsx from 'clsx';
import React, { useMemo } from 'react';
import { P, match } from 'ts-pattern';

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
      .filter((t) => ![NodeKind.Input].includes(nodeTypes?.[t.nodeId] as NodeKind))
      .filter((t) => t.name.toLowerCase().includes(search?.toLowerCase() ?? ''))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [simulate, viewConfig, nodeTypes, search]);

  return (
    <>
      <div className={'grl-dg__simulator__section__bar grl-dg__simulator__section__bar--nodes'}>
        <input
          className='grl-dg__simulator__search'
          type='text'
          placeholder='Search nodes...'
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className={'grl-dg__simulator__section__bar__actions'}>
          {onClear && (
            <Tooltip title={'Clear'} placement='bottomRight'>
              <Button
                size={'small'}
                type={'text'}
                icon={<ClearOutlined />}
                onClick={() => onClear?.()}
              />
            </Tooltip>
          )}
        </div>
      </div>
      <div className={'grl-dg__simulator__section__content'}>
        <Spin spinning={loading}>
          <div className={'grl-dg__simulator__nodes-list'}>
            {!simulate && (
              <Typography.Text type='secondary' style={{ textAlign: 'center', marginTop: 60, fontSize: 13 }}>
                Ready to simulate!
                <br />
                Run a request to see the node trace in action.
                <br />
                <Typography.Link
                  href='https://docs.gorules.io/docs/simulator'
                  target='_blank'
                  style={{ fontSize: 13, marginTop: 4, display: 'inline-block' }}
                >
                  Learn more
                </Typography.Link>
              </Typography.Text>
            )}
            {'graph'.includes(search?.toLowerCase() ?? '') && simulate && (
              <div
                className={clsx('grl-dg__simulator__nodes-list__node', selectedNode === 'graph' && 'active')}
                onClick={() => onSelectNode('graph')}
              >
                <Typography.Text data-role='name' ellipsis>
                  <StatusIcon
                    status={match(simulate)
                      .with({ error: P.nonNullable }, () => 'error' as const)
                      .with({ result: P.nonNullable }, () => 'success' as const)
                      .otherwise(() => 'not-run' as const)}
                  />
                  Graph
                </Typography.Text>
                <Typography.Text type={'secondary'} data-role='performance'>
                  {match(simulate)
                    .with({ result: P._ }, ({ result }) => result?.performance)
                    .otherwise(() => undefined)}
                </Typography.Text>
              </div>
            )}
            {traces.map((trace) => (
              <div
                key={trace.nodeId}
                className={clsx('grl-dg__simulator__nodes-list__node', trace.nodeId === selectedNode && 'active')}
                onClick={() => onSelectNode(trace.nodeId)}
                onDoubleClick={() => onGoToNode(trace.nodeId)}
              >
                <Typography.Text data-role='name' ellipsis={{ tooltip: trace.name }}>
                  <StatusIcon status={trace.nodeId === simulate?.error?.data?.nodeId ? 'error' : 'success'} />
                  {trace.name}
                </Typography.Text>
                <Typography.Text type={'secondary'} data-role='performance'>
                  {trace.performance}
                </Typography.Text>
              </div>
            ))}
          </div>
        </Spin>
      </div>
    </>
  );
};

const StatusIcon: React.FC<{ status: SimulatorNodesPanelStatus }> = ({ status }) => {
  if (status === 'not-run') {
    return null;
  }

  if (status === 'success') {
    return (
      <CheckCircleTwoTone
        twoToneColor={['var(--grl-color-success)', 'var(--grl-color-success-bg)']}
        style={{ marginRight: 6, fontSize: 12, opacity: 0.5 }}
      />
    );
  }

  return (
    <CloseCircleTwoTone
      twoToneColor={['var(--grl-color-error)', 'var(--grl-color-error-bg)']}
      style={{ marginRight: 5, fontSize: 12 }}
    />
  );
};
