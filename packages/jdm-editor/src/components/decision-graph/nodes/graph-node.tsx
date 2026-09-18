import { BookOutlined, CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '#icons';
import type { HandleProps } from '@xyflow/react';
import { Handle, NodeToolbar, Position } from '@xyflow/react';
import clsx from 'clsx';
import React from 'react';
import { P, match } from 'ts-pattern';

import { platform } from '../../../helpers/platform';
import { usePersistentState } from '../../../helpers/use-persistent-state';
import { useT } from '../../../theming/i18n';
import type { MenuProps } from '../../primitives';
import { App, Button, Typography } from '../../primitives';
import { SpacedText } from '../../spaced-text';
import { useDecisionGraphActions, useDecisionGraphState, useNodeDiff } from '../context/dg-store.context';
import type { DecisionNodeProps } from './decision-node';
import { DecisionNode } from './decision-node';
import type { MinimalNodeSpecification } from './specifications/specification-types';

enum Details {
  Settings,
}

export type GraphNodeProps = {
  id: string;
  handleLeft?: boolean | Partial<HandleProps>;
  handleRight?: boolean | Partial<HandleProps>;
  className?: string;
  specification: MinimalNodeSpecification;
  displayError?: boolean;
} & Partial<DecisionNodeProps>;

export const GraphNode = React.forwardRef<HTMLDivElement, GraphNodeProps>(
  (
    {
      id,
      handleLeft = true,
      handleRight = true,
      className,
      specification,
      name,
      displayError,
      isSelected,
      helper,
      actions,
      ...decisionNodeProps
    },
    ref,
  ) => {
    const t = useT();
    const [hovered, setHovered] = React.useState(false);
    const [currentDetails, setCurrentDetails] = usePersistentState<Details>(`node:details:${id}`, Details.Settings);
    const [detailsOpen, setDetailsOpen] = usePersistentState<boolean>(`node:detailsOpen:${id}`, false);
    const graphActions = useDecisionGraphActions();
    const { modal } = App.useApp();
    const { nodeError, nodeTrace, disabled, compactMode } = useDecisionGraphState(
      ({ simulate, disabled, compactMode }) => ({
        disabled,
        nodeTrace: match(simulate)
          .with({ result: P._ }, ({ result }) => result?.trace?.[id])
          .otherwise(() => null),
        nodeError: match(simulate)
          .with({ error: { data: { nodeId: id } } }, ({ error }) => error)
          .otherwise(() => null),
        compactMode,
      }),
    );

    const { diff } = useNodeDiff(id);

    const Settings = specification.renderSettings;

    const openSettings = () => {
      setDetailsOpen(currentDetails === Details.Settings ? !detailsOpen : true);
      setCurrentDetails(Details.Settings);
    };

    const confirmDelete = () =>
      modal.confirm({
        icon: null,
        title: t('dg.node.deleteNode'),
        content: (
          <Typography.Text>
            Are you sure you want to delete <Typography.Text strong>{name}</Typography.Text> node.
          </Typography.Text>
        ),
        okButtonProps: { danger: true },
        onOk: () => graphActions.removeNodes([id]),
      });

    const menuItems = [
      specification.documentationUrl
        ? {
            key: 'documentation',
            label: <SpacedText left={t('dg.node.documentation')} right={<BookOutlined />} />,
            onClick: () => window.open(specification.documentationUrl, '_href'),
          }
        : null,
      specification.documentationUrl ? { key: 'divider-1', type: 'divider' } : null,
      !displayError && {
        key: 'copy-clipboard',
        label: <SpacedText left={t('func.debugger.copy')} right={platform.shortcut('Ctrl + C')} />,
        onClick: () => graphActions.copyNodes([id]),
      },
      !displayError && {
        key: 'duplicate',
        disabled,
        label: <SpacedText left={t('dg.node.duplicate')} right={platform.shortcut('Ctrl + D')} />,
        onClick: () => graphActions.duplicateNodes([id]),
      },
      !displayError && { key: 'divider-2', type: 'divider' },
      {
        key: 'delete',
        danger: true,
        label: <SpacedText left={t('common.delete')} right={platform.shortcut('Backspace')} />,
        disabled,
        onClick: confirmDelete,
      },
    ].filter((i) => i !== null && i !== false);

    return (
      <div
        className={clsx('grl-graph-node', className)}
        style={{ minWidth: 220, maxWidth: 220 }}
        ref={ref}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(event) => {
          const isToggle = match(navigator.platform.includes('Mac'))
            .with(true, () => event.metaKey)
            .otherwise(() => event.ctrlKey);

          graphActions.triggerNodeSelect(id, isToggle ? 'toggle' : 'only');
        }}
      >
        {/* WS1-R2：悬停/选中显现的快捷工具栏（flow-1 node toolbar 模式） */}
        <NodeToolbar isVisible={isSelected || hovered} position={Position.Top} offset={10}>
          <div className='nodrag nopan flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--grl-color-bg-container)] p-0.5 shadow-md'>
            {Settings && (
              <Button
                type='text'
                size='small'
                className='h-6 w-6 p-0'
                aria-label='Settings'
                icon={<EditOutlined />}
                onClick={openSettings}
              />
            )}
            <Button
              type='text'
              size='small'
              className='h-6 w-6 p-0'
              aria-label='Copy'
              icon={<CopyOutlined />}
              onClick={() => graphActions.copyNodes([id])}
            />
            <Button
              type='text'
              size='small'
              className='h-6 w-6 p-0'
              aria-label='Duplicate'
              disabled={disabled}
              icon={<PlusOutlined />}
              onClick={() => graphActions.duplicateNodes([id])}
            />
            <Button
              type='text'
              size='small'
              className='h-6 w-6 p-0 text-[var(--destructive)]'
              aria-label='Delete'
              disabled={disabled}
              icon={<DeleteOutlined />}
              onClick={confirmDelete}
            />
          </div>
        </NodeToolbar>
        {handleLeft && (
          <Handle
            className={clsx('grl-graph-node__handle-left', compactMode && 'compact')}
            type='target'
            position={Position.Left}
            {...(typeof handleLeft !== 'boolean' ? handleLeft : {})}
          />
        )}
        <DecisionNode
          menuItems={menuItems as MenuProps['items']}
          {...decisionNodeProps}
          disabled={disabled}
          icon={specification.icon}
          color={specification.color}
          type={specification.displayName}
          helper={helper}
          name={name}
          details={Settings ? <Settings id={id} /> : undefined}
          detailsOpen={detailsOpen}
          detailsTitle={match(currentDetails)
            .with(Details.Settings, () => 'Settings')
            .otherwise(() => undefined)}
          onDetailsClose={() => setDetailsOpen(false)}
          actions={
            !Settings
              ? actions
              : [
                  ...(actions ?? []),
                  <Button key='settings' type='text' style={{ marginLeft: 'auto' }} onClick={openSettings}>
                    Settings
                  </Button>,
                ]
          }
          status={match([nodeTrace, nodeError, displayError])
            .with([P._, P._, true], () => 'error' as const)
            .with([P._, P.not(P.nullish), P._], () => 'error' as const)
            .with([P.not(P.nullish), P._, P._], () => 'success' as const)
            .otherwise(() => undefined)}
          diffStatus={match([diff])
            .with([{ status: 'added' }], () => 'added' as const)
            .with([{ status: 'modified' }], () => 'modified' as const)
            .with([{ status: 'removed' }], () => 'removed' as const)
            .with([{ status: 'moved' }], () => 'moved' as const)
            .otherwise(() => undefined)}
          onNameChange={(name) => {
            graphActions.updateNode(id, (draft) => {
              draft.name = name;
              return draft;
            });
          }}
          compactMode={compactMode}
        />
        {handleRight && (
          <Handle
            className={clsx('grl-graph-node__handle-right', compactMode && 'compact')}
            type='source'
            position={Position.Right}
            {...(typeof handleRight !== 'boolean' ? handleRight : {})}
          />
        )}
      </div>
    );
  },
);
