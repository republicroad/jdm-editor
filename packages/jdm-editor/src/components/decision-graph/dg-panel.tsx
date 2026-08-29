import { CloseOutlined } from '@/icons';
import { Resizable } from 're-resizable';
import React, { useMemo } from 'react';

import { useT } from '../../theming/i18n';
import { Button, Tooltip, Typography } from '../primitives';
import { useDecisionGraphActions, useDecisionGraphState } from './context/dg-store.context';

const heightKey = 'jdmEditor:graphPanel:height';

export const GraphPanel: React.FC = () => {
  const t = useT();
  const graphActions = useDecisionGraphActions();
  const { panels, activePanel: activePanelId } = useDecisionGraphState(({ panels, activePanel }) => ({
    panels,
    activePanel,
  }));

  const activePanel = useMemo(() => {
    return activePanelId === undefined ? undefined : (panels || []).find((panel) => panel.id === activePanelId);
  }, [activePanelId, panels]);

  const defaultHeight = useMemo(() => {
    return Number.parseFloat(localStorage.getItem(heightKey) ?? '') ?? 300;
  }, [activePanel]);

  if (!activePanel) return null;

  return (
    <Resizable
      className={
        'relative flex h-full w-full flex-col border-t border-t-[var(--border)] bg-[var(--grl-color-primary-bg-fade)]'
      }
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
        <div
          className={
            'flex flex-row items-center justify-start gap-2 border-b border-b-[var(--border)] py-1 pl-2 pr-1 [&>span]:text-[13px]'
          }
        >
          <div className={'grow'}>
            <Typography.Text style={{ fontSize: 13 }}>{activePanel.title}</Typography.Text>
          </div>
          <div className={'shrink'}>
            <Tooltip placement='topLeft' title={t('dg.toolbar.closeClose')}>
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
      <div className={'min-h-0 flex-1 overflow-hidden'}>{activePanel?.renderPanel?.()}</div>
    </Resizable>
  );
};
