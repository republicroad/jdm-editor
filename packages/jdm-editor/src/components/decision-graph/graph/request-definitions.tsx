import { DeleteOutlined, DownOutlined, PlusCircleOutlined, PlusOutlined, RightOutlined } from '#icons';
import React from 'react';

import type { RequestDefinition, RequestDefinitionType } from '../../../helpers/request-schema';
import { useT } from '../../../theming/i18n';
import { Button, Popconfirm, Select, Tooltip } from '../../primitives';
import { BlurCommitInput } from './blur-commit-input';

export type RequestDefinitionsProps = {
  rootDefinitions: RequestDefinition[];
  childrenMap: Map<string, RequestDefinition[]>;
  collapsedPaths: Record<string, boolean>;
  disabled: boolean;
  definitionTypeOptions: Array<{ value: RequestDefinitionType; label: string }>;
  onAdd: () => void;
  onUpdateName: (index: number, name: string) => void;
  onUpdateType: (index: number, type: RequestDefinitionType) => void;
  onUpdateDescription: (index: number, description: string) => void;
  onUpdateDefaultValue: (index: number, defaultValue: string) => void;
  onAddChild: (index: number) => void;
  onRemove: (index: number) => void;
  onToggleCollapse: (path: string) => void;
  getDefinitionIndex: (definitionId: string) => number;
};

type DefinitionCardProps = Omit<RequestDefinitionsProps, 'rootDefinitions' | 'onAdd'> & {
  definition: RequestDefinition;
  definitionIndex: number;
};

const GRID_COLS =
  'grid grid-cols-[minmax(120px,200px)_minmax(100px,150px)_minmax(100px,150px)_minmax(180px,320px)_88px] gap-3 items-start';

const DefinitionCard: React.FC<DefinitionCardProps> = ({
  definition,
  childrenMap,
  collapsedPaths,
  disabled,
  definitionTypeOptions,
  definitionIndex,
  onUpdateName,
  onUpdateType,
  onUpdateDescription,
  onUpdateDefaultValue,
  onAddChild,
  onRemove,
  onToggleCollapse,
  getDefinitionIndex,
}) => {
  const t = useT();

  const childDefinitions = childrenMap.get(definition.path) ?? [];
  const hasChildDefinitions = childDefinitions.length > 0;
  const canAddChild = definition.type === 'object' || hasChildDefinitions;
  const canToggleChildren = hasChildDefinitions;
  const isCollapsed = Boolean(collapsedPaths[definition.path]);
  const depthOffset = `calc(min(${definition.depth} * 12px, 24px) + 4px)`;

  const isInTree = definition.depth > 0;

  return (
    <div
      key={definition.id}
      className={isInTree ? 'overflow-visible' : 'overflow-hidden rounded-xl border border-border bg-card shadow-sm'}
    >
      <div className={`${GRID_COLS} p-3 ${isInTree ? '!px-0' : ''}`}>
        <div
          className='relative min-w-0 pl-[var(--depth-offset)] [--depth-offset:4px]'
          style={{ '--depth-offset': depthOffset } as React.CSSProperties}
        >
          <div className='flex w-full min-w-0 items-center gap-2'>
            {definition.depth > 0 && (
              <span aria-hidden className='pointer-events-none absolute inset-y-1.5 left-0 w-px bg-border opacity-70' />
            )}
            {canToggleChildren ? (
              <Button
                type='text'
                size='small'
                disabled={disabled}
                className='!h-6 !w-6 shrink-0 !p-0 opacity-60'
                icon={
                  isCollapsed ? <RightOutlined style={{ fontSize: 11 }} /> : <DownOutlined style={{ fontSize: 11 }} />
                }
                onClick={() => onToggleCollapse(definition.path)}
              />
            ) : (
              <span aria-hidden className='h-6 w-6 shrink-0' />
            )}
            <BlurCommitInput
              disabled={disabled}
              placeholder={
                definition.depth > 0 ? t('request.childFieldNamePlaceholder') : t('request.fieldNamePlaceholder')
              }
              value={definition.name}
              onCommit={(nextValue) => onUpdateName(definitionIndex, nextValue)}
            />
          </div>
        </div>
        <Select
          disabled={disabled}
          options={definitionTypeOptions}
          value={definition.type}
          onChange={(value) => onUpdateType(definitionIndex, value)}
        />
        <BlurCommitInput
          disabled={disabled}
          placeholder={t('request.fieldDefaultValuePlaceholder')}
          value={definition.defaultValue ?? ''}
          onCommit={(nextValue) => onUpdateDefaultValue(definitionIndex, nextValue)}
        />
        <BlurCommitInput
          disabled={disabled}
          placeholder={t('request.fieldDescriptionPlaceholder')}
          value={definition.description}
          onCommit={(nextValue) => onUpdateDescription(definitionIndex, nextValue)}
        />
        <div className='flex items-center justify-end gap-1'>
          {canAddChild && (
            <Tooltip title={t('request.addChildField')}>
              <Button
                type='text'
                size='small'
                disabled={disabled || !definition.name.trim()}
                icon={<PlusOutlined />}
                onClick={() => onAddChild(definitionIndex)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title={t('request.deleteFieldConfirm')}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
            disabled={disabled}
            onConfirm={() => onRemove(definitionIndex)}
          >
            <Button danger type='text' disabled={disabled} icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      </div>

      {hasChildDefinitions && !isCollapsed && (
        <div className='relative mx-3 mb-3 flex flex-col gap-1.5 pb-2 pl-[22px]'>
          <span
            aria-hidden
            className='pointer-events-none absolute bottom-2.5 left-2 top-1 w-px bg-border opacity-70'
          />
          {childDefinitions.map((childDefinition) => (
            <DefinitionCard
              key={childDefinition.id}
              definition={childDefinition}
              childrenMap={childrenMap}
              collapsedPaths={collapsedPaths}
              disabled={disabled}
              definitionTypeOptions={definitionTypeOptions}
              definitionIndex={getDefinitionIndex(childDefinition.id)}
              onUpdateName={onUpdateName}
              onUpdateType={onUpdateType}
              onUpdateDescription={onUpdateDescription}
              onUpdateDefaultValue={onUpdateDefaultValue}
              onAddChild={onAddChild}
              onRemove={onRemove}
              onToggleCollapse={onToggleCollapse}
              getDefinitionIndex={getDefinitionIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const RequestDefinitions: React.FC<RequestDefinitionsProps> = ({
  rootDefinitions,
  childrenMap,
  collapsedPaths,
  disabled,
  definitionTypeOptions,
  onAdd,
  onUpdateName,
  onUpdateType,
  onUpdateDescription,
  onUpdateDefaultValue,
  onAddChild,
  onRemove,
  onToggleCollapse,
  getDefinitionIndex,
}) => {
  const t = useT();

  return (
    <div className='flex h-full min-h-0 flex-col gap-2'>
      <div className='min-h-0 flex-1 space-y-2.5 overflow-y-auto'>
        <div
          className={`${GRID_COLS} rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-xs font-semibold uppercase tracking-wide text-foreground opacity-70`}
        >
          <span>{t('request.key')}</span>
          <span>{t('request.type')}</span>
          <span>{t('request.fieldDefaultValuePlaceholder')}</span>
          <span>{t('request.description')}</span>
          <span />
        </div>

        {rootDefinitions.length === 0 ? (
          <div className='flex flex-col items-center gap-1 py-10 text-xs text-muted-foreground'>
            <span>{t('request.noDefinitions')}</span>
          </div>
        ) : (
          rootDefinitions.map((definition) => (
            <DefinitionCard
              key={definition.id}
              definition={definition}
              childrenMap={childrenMap}
              collapsedPaths={collapsedPaths}
              disabled={disabled}
              definitionTypeOptions={definitionTypeOptions}
              definitionIndex={getDefinitionIndex(definition.id)}
              onUpdateName={onUpdateName}
              onUpdateType={onUpdateType}
              onUpdateDescription={onUpdateDescription}
              onUpdateDefaultValue={onUpdateDefaultValue}
              onAddChild={onAddChild}
              onRemove={onRemove}
              onToggleCollapse={onToggleCollapse}
              getDefinitionIndex={getDefinitionIndex}
            />
          ))
        )}
      </div>

      <div className='pb-3 pt-0.5'>
        <Button className='!pl-0' type='link' icon={<PlusCircleOutlined />} disabled={disabled} onClick={onAdd}>
          {t('request.addField')}
        </Button>
      </div>
    </div>
  );
};
