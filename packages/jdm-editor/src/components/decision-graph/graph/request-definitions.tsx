import { DeleteOutlined, DownOutlined, PlusCircleOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Empty, Popconfirm, Select, Tooltip, Typography } from 'antd';
import React from 'react';

import { BlurCommitInput } from './blur-commit-input';
import type { RequestDefinition, RequestDefinitionType } from '../../../helpers/request-schema';
import { useTranslation } from '../../../locales';

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

type DefinitionCardProps = {
  definition: RequestDefinition;
  childrenMap: Map<string, RequestDefinition[]>;
  collapsedPaths: Record<string, boolean>;
  disabled: boolean;
  definitionTypeOptions: Array<{ value: RequestDefinitionType; label: string }>;
  definitionIndex: number;
  onUpdateName: (index: number, name: string) => void;
  onUpdateType: (index: number, type: RequestDefinitionType) => void;
  onUpdateDescription: (index: number, description: string) => void;
  onUpdateDefaultValue: (index: number, defaultValue: string) => void;
  onAddChild: (index: number) => void;
  onRemove: (index: number) => void;
  onToggleCollapse: (path: string) => void;
  getDefinitionIndex: (definitionId: string) => number;
};

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
  const { t } = useTranslation();

  const childDefinitions = childrenMap.get(definition.path) ?? [];
  const hasChildDefinitions = childDefinitions.length > 0;
  const canAddChild = definition.type === 'object' || hasChildDefinitions;
  const canToggleChildren = hasChildDefinitions;
  const isCollapsed = Boolean(collapsedPaths[definition.path]);

  return (
    <div
      className={`grl-request-tab__definition-card ${
        definition.type === 'object' ? 'grl-request-tab__definition-card--object' : ''
      }`}
      key={definition.id}
    >
      <div className='grl-request-tab__definition-row'>
        <div
          className='grl-request-tab__definition-key'
          style={{ '--definition-depth': definition.depth } as React.CSSProperties}
        >
          <div className='grl-request-tab__definition-key__inner'>
            {definition.depth > 0 && <span className='grl-request-tab__definition-key__guide' aria-hidden />}
            <div className='grl-request-tab__definition-key__content'>
              {canToggleChildren ? (
                <Button
                  type='text'
                  size='small'
                  disabled={disabled}
                  className='grl-request-tab__definition-toggle'
                  icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
                  onClick={() => onToggleCollapse(definition.path)}
                />
              ) : (
                <span className='grl-request-tab__definition-toggle-spacer' aria-hidden />
              )}
              <BlurCommitInput
                disabled={disabled}
                placeholder={
                  definition.depth > 0 ? t('requestChildFieldNamePlaceholder') : t('requestFieldNamePlaceholder')
                }
                value={definition.name}
                onCommit={(nextValue) => onUpdateName(definitionIndex, nextValue)}
              />
            </div>
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
          placeholder={t('requestFieldDefaultValuePlaceholder')}
          value={definition.defaultValue ?? ''}
          onCommit={(nextValue) => onUpdateDefaultValue(definitionIndex, nextValue)}
        />
        <BlurCommitInput
          disabled={disabled}
          placeholder={t('requestFieldDescriptionPlaceholder')}
          value={definition.description}
          onCommit={(nextValue) => onUpdateDescription(definitionIndex, nextValue)}
        />
        <div className='grl-request-tab__definition-actions'>
          {canAddChild && (
            <Tooltip title={t('requestAddChildField')}>
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
            title={t('requestDeleteFieldConfirm')}
            okText={t('delete')}
            cancelText={t('cancel')}
            disabled={disabled}
            onConfirm={() => onRemove(definitionIndex)}
          >
            <Button
              danger
              type='text'
              disabled={disabled}
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </div>
      </div>

      {hasChildDefinitions && !isCollapsed && (
        <div className='grl-request-tab__definition-children'>
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
  const { t } = useTranslation();

  return (
    <div className='grl-request-tab__body'>
      <div className='grl-request-tab__surface grl-request-tab__surface--definitions'>
        <div className='grl-request-tab__grid grl-request-tab__grid--definitions'>
          <div className='grl-request-tab__grid-header grl-request-tab__grid-header--definitions'>
            <span>{t('key')}</span>
            <span>{t('type')}</span>
            <span>{t('requestFieldDefaultValuePlaceholder')}</span>
            <span>{t('description')}</span>
            <span />
          </div>

          {rootDefinitions.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('requestNoDefinitions')}
            />
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
      </div>

      <div className='grl-request-tab__add-row'>
        <Button
          className='grl-request-tab__add-row__button'
          type='link'
          icon={<PlusCircleOutlined />}
          disabled={disabled}
          onClick={onAdd}
        >
          {t('requestAddField')}
        </Button>
      </div>
    </div>
  );
};
