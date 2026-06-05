import { CloseOutlined } from '@ant-design/icons';
import { Button, Select, Tooltip, Typography } from 'antd';
import { Resizable } from 're-resizable';
import React, { useMemo } from 'react';

import {
  getRequestDefinitions,
  getRequestExampleSources,
  normalizeRequestExampleDataByDefinitions,
} from '../../helpers/request-schema';
import { useTranslation } from '../../locales';
import { useDecisionGraphActions, useDecisionGraphState } from './context/dg-store.context';

const heightKey = 'jdmEditor:graphPanel:height';

export const GraphPanel: React.FC = () => {
  const { t } = useTranslation();
  const graphActions = useDecisionGraphActions();
  const {
    panels,
    activePanel: activePanelId,
    simulatorExampleBinding,
    inputNodeContent,
    inputNodeId,
  } = useDecisionGraphState(({ panels, activePanel, simulatorExampleBinding, decisionGraph }) => {
    const inputNode = decisionGraph?.nodes?.find((node) => node.type === 'inputNode');

    return {
      panels,
      activePanel,
      simulatorExampleBinding,
      inputNodeContent: inputNode?.content,
      inputNodeId: inputNode?.id,
    };
  });

  const activePanel = useMemo(() => {
    return activePanelId === undefined ? undefined : (panels || []).find((panel) => panel.id === activePanelId);
  }, [activePanelId, panels]);

  const simulatorRequestSources = useMemo(
    () => getRequestExampleSources(inputNodeContent, { dataLabel: t('requestDataLabel') }),
    [inputNodeContent, t],
  );
  const simulatorRequestDefinitions = useMemo(() => getRequestDefinitions(inputNodeContent), [inputNodeContent]);
  const simulatorSourceOptions = useMemo(
    () => simulatorRequestSources.map((source, index) => ({ value: index, label: source.name })),
    [simulatorRequestSources],
  );
  const selectedSimulatorSourceIndex = useMemo(() => {
    if (activePanel?.id !== 'simulator' || simulatorRequestSources.length <= 1) {
      return undefined;
    }

    if (
      simulatorExampleBinding?.nodeId === inputNodeId &&
      simulatorExampleBinding.sourceIndex >= 0 &&
      simulatorExampleBinding.sourceIndex < simulatorRequestSources.length
    ) {
      return simulatorExampleBinding.sourceIndex;
    }

    return 0;
  }, [activePanel?.id, inputNodeId, simulatorExampleBinding, simulatorRequestSources.length]);
  const simulatorBindingLabel = useMemo(() => {
    if (activePanel?.id !== 'simulator' || !simulatorExampleBinding || simulatorExampleBinding.nodeId !== inputNodeId) {
      return null;
    }

    const boundSource = simulatorRequestSources[simulatorExampleBinding.sourceIndex];
    if (!boundSource) {
      return null;
    }

    return `${t('requestCurrentDataSourceLabel')}: ${boundSource.name}`;
  }, [activePanel?.id, inputNodeId, simulatorExampleBinding, simulatorRequestSources, t]);
  const shouldShowSimulatorSourceSelect =
    Boolean(simulatorBindingLabel) && Boolean(inputNodeId) && simulatorRequestSources.length > 1;

  const handleSimulatorSourceChange = (sourceIndex: number) => {
    const source = simulatorRequestSources[sourceIndex];

    if (!inputNodeId || !source) {
      return;
    }

    const normalizedData = normalizeRequestExampleDataByDefinitions(source.data, simulatorRequestDefinitions);
    const formattedRequest = JSON.stringify(normalizedData, null, 2);

    graphActions.setSimulatorRequest(formattedRequest);
    graphActions.setSimulatorExampleBinding({
      nodeId: inputNodeId,
      sourceIndex,
      sourceName: source.name,
    });
  };

  const defaultHeight = useMemo(() => {
    return Number.parseFloat(localStorage.getItem(heightKey) ?? '') ?? 300;
  }, [activePanel]);

  if (!activePanel) return null;

  return (
    <Resizable
      className={'grl-dg__panel'}
      defaultSize={{ height: defaultHeight }}
      handleStyles={{
        bottom: { display: 'none' },
        left: { display: 'none' },
        topLeft: { display: 'none' },
        topRight: { display: 'none' },
        right: { display: 'none' },
        bottomLeft: { display: 'none' },
        bottomRight: { display: 'none' },
      }}
      maxHeight={500}
      minHeight={150}
      onResize={(event, direction, elementRef) => {
        localStorage.setItem(heightKey, elementRef.clientHeight.toString());
      }}
    >
      {!activePanel.hideHeader && (
        <div className={'grl-dg__panel__toolbar'}>
          <div className={'grl-dg__panel__toolbar__content'}>
            <div className={'grl-dg__panel__toolbar__title'}>
              <Typography.Text style={{ fontSize: 13 }}>{activePanel.title}</Typography.Text>
              {shouldShowSimulatorSourceSelect && (
                <div className={'grl-dg__panel__toolbar__source-select'}>
                  <Typography.Text className={'grl-dg__panel__toolbar__meta'} type='secondary'>
                    {t('requestCurrentDataSourceLabel')}:
                  </Typography.Text>
                  <Select
                    size='small'
                    variant='filled'
                    value={selectedSimulatorSourceIndex}
                    options={simulatorSourceOptions}
                    popupMatchSelectWidth={false}
                    popupClassName={'grl-dg__panel__toolbar__source-select-popup'}
                    className={'grl-dg__panel__toolbar__source-select__control'}
                    onChange={handleSimulatorSourceChange}
                  />
                </div>
              )}
              {simulatorBindingLabel && !shouldShowSimulatorSourceSelect && (
                <Typography.Text className={'grl-dg__panel__toolbar__meta'} type='secondary'>
                  {simulatorBindingLabel}
                </Typography.Text>
              )}
            </div>
          </div>
          <div className={'grl-dg__panel__toolbar__actions'}>
            <Tooltip placement='topLeft' title={t('closePanel')}>
              <Button
                size={'small'}
                type={'text'}
                icon={<CloseOutlined style={{ fontSize: 12 }} />}
                onClick={() => graphActions.setActivePanel(undefined)}
              />
            </Tooltip>
          </div>
        </div>
      )}
      <div className={'grl-dg__panel__content'}>{activePanel?.renderPanel?.({})}</div>
    </Resizable>
  );
};
