import { CloseOutlined } from '@/icons';
import json5 from 'json5';
import React, { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { P, match } from 'ts-pattern';

import '../../../helpers/monaco';
import { usePersistentState } from '../../../helpers/use-persistent-state';
import { useT } from '../../../theming/i18n';
import { Button, Tabs, Tooltip } from '../../primitives';
import { useDecisionGraphRaw, useDecisionGraphState } from '../context/dg-store.context';
import { NodeKind } from '../nodes/specifications/specification-types';
import { SimulatorEditor } from './simulator-editor';
import { SimulatorNodesPanel } from './simulator-nodes-panel';
import { SimulatorRequestPanel, type SimulatorRequestPanelProps } from './simulator-request-panel';

enum SimulationSegment {
  Output = 'Output',
  Input = 'Input',
  Trace = 'Trace',
}

export type GraphSimulatorProps = {
  onClear?: () => void;
  loading?: boolean;
  defaultRequest?: SimulatorRequestPanelProps['defaultRequest'];
  onChange?: SimulatorRequestPanelProps['onChange'];
  onRun?: SimulatorRequestPanelProps['onRun'];
  leftPanel?: React.FC<SimulatorRequestPanelProps>;
};

export const GraphSimulator: React.FC<GraphSimulatorProps> = ({
  defaultRequest,
  onChange,
  onRun,
  onClear,
  loading = false,
  leftPanel: LeftPanel = SimulatorRequestPanel,
}) => {
  const t = useT();
  const [search, setSearch] = usePersistentState<string>('simulation.search', '');
  const [segment, setSegment] = usePersistentState<SimulationSegment>('simulation.segment', SimulationSegment.Output);

  const { viewConfig } = useDecisionGraphState((state) => ({
    viewConfig: state.viewConfig,
  }));

  const { actions } = useDecisionGraphRaw();
  const { nodeTypes, simulate, hasInputNode } = useDecisionGraphState(({ decisionGraph, simulate }) => ({
    simulate,
    hasInputNode: decisionGraph.nodes.some((n) => n.type === NodeKind.Input),
    nodeTypes: (decisionGraph.nodes ?? []).reduce<Record<string, string | undefined>>(
      (acc, curr) => ({
        ...acc,
        [curr.id]: curr.type,
      }),
      {},
    ),
  }));

  const [selectedNode, setSelectedNode] = useState<string>('graph');

  return (
    <PanelGroup
      className='h-full w-full bg-[var(--grl-color-primary-bg-fade)]'
      direction='horizontal'
      autoSaveId='jdm-editor:simulator:layout'
    >
      <Panel minSize={20} defaultSize={38} className='flex w-[300px] flex-col'>
        <LeftPanel
          defaultRequest={defaultRequest}
          loading={loading}
          hasInputNode={hasInputNode}
          onRun={onRun}
          onChange={onChange}
        />
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={20} maxSize={20} className={'flex w-[260px] flex-col'}>
        <SimulatorNodesPanel
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          simulate={simulate}
          nodeTypes={nodeTypes}
          viewConfig={viewConfig}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onClear={() => {
            onClear?.();
            setSelectedNode('graph');
            setSearch('');
          }}
          onGoToNode={(nodeId) => actions.goToNode(nodeId)}
        />
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={30} defaultSize={42} className={'flex min-w-[300px] flex-1 flex-col'}>
        <div className='flex h-9 select-none items-center justify-between gap-1 border-b border-b-[var(--border)] pl-0 pr-2'>
          <Tabs
            size='small'
            style={{ width: '100%' }}
            onChange={(tab) => setSegment(tab as SimulationSegment)}
            items={Object.values(SimulationSegment).map((s) => ({
              key: s,
              label: s,
            }))}
            tabBarExtraContent={
              <Tooltip title={t('dg.toolbar.closeClose')} placement='bottomRight'>
                <Button
                  type='text'
                  icon={<CloseOutlined style={{ fontSize: 12 }} />}
                  onClick={() => actions.setActivePanel(undefined)}
                />
              </Tooltip>
            }
          />
        </div>
        <div className={'min-h-0 flex-1 overflow-y-auto'}>
          <SimulatorEditor
            readOnly
            value={match(simulate)
              .with({ result: P._ }, ({ result }) =>
                match(selectedNode)
                  .with('graph', () =>
                    displaySegment(
                      {
                        traceData: result?.trace,
                        output: result?.result,
                      },
                      segment ?? SimulationSegment.Output,
                    ),
                  )
                  .otherwise(() => displaySegment(result?.trace[selectedNode], segment ?? SimulationSegment.Output)),
              )
              .otherwise(() => '')}
          />
        </div>
      </Panel>
    </PanelGroup>
  );
};

const displaySegment = (data: unknown, segment: SimulationSegment) => {
  const jsonData = match([segment, data])
    .with([SimulationSegment.Output, { output: P._ }], ([, { output }]) => output)
    .with([SimulationSegment.Input, { input: P._ }], ([, { input }]) => input)
    .with([SimulationSegment.Trace, { trace: P._ }], ([, { trace }]) => trace)
    .with([SimulationSegment.Trace, { traceData: P._ }], ([, { traceData }]) => traceData)
    .otherwise(() => ({}));

  return json5.stringify(jsonData, undefined, 2);
};
