import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  FormatPainterOutlined,
  ImportOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Space, Tabs, Tooltip, theme } from 'antd';
import type { DragDropManager } from 'dnd-core';
import type { editor } from 'monaco-editor';
import React, { useMemo, useState } from 'react';

import '../../../helpers/monaco';
import { useTranslation } from '../../../locales';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { RequestDefinitions } from './request-definitions';
import { RequestExamples } from './request-examples';
import { RequestSchemaEditor } from './request-schema-editor';
import './tab-request.scss';
import { useRequestDefinitionsEditing } from './use-request-definitions-editing';
import { useRequestExamplesEditing } from './use-request-examples-editing';
import { useRequestSchemaEditing } from './use-request-schema-editing';

export type TabRequestProps = {
  id: string;
  manager?: DragDropManager;
  menuList?: any[];
  type?: string;
};

enum RequestTabKey {
  Definitions = 'definitions',
  Examples = 'examples',
  Schema = 'schema',
}

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  contextmenu: false,
  fontSize: 13,
  fontFamily: 'var(--mono-font-family)',
  tabSize: 2,
  minimap: { enabled: false },
  overviewRulerBorder: false,
  scrollbar: {
    verticalSliderSize: 4,
    verticalScrollbarSize: 4,
    horizontalScrollbarSize: 4,
    horizontalSliderSize: 4,
  },
};

export const TabRequest: React.FC<TabRequestProps> = ({ id, type }) => {
  const { t } = useTranslation();
  const graphActions = useDecisionGraphActions();
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState<RequestTabKey>(RequestTabKey.Definitions);

  const {
    disabled: disabledRaw,
    content,
    nodeName,
    panels,
    activePanel,
    activeGraphTabId,
    simulatorExampleBinding,
  } = useDecisionGraphState(({ disabled, decisionGraph, panels, activePanel, activeTab, simulatorExampleBinding }) => ({
    disabled,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content,
    nodeName: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.name ?? t('request'),
    panels,
    activePanel,
    activeGraphTabId: activeTab,
    simulatorExampleBinding,
  }));
  const disabled = disabledRaw ?? false;

  const {
    schemaEditorRef,
    sourceSchemaValue,
    schemaDraft,
    jsonToJsonSchemaOpen,
    setJsonToJsonSchemaOpen,
    updateNodeSchema,
    handleSchemaDraftChange,
    commitSchemaDraft,
    handleConvertToJsonSchemaSuccess,
  } = useRequestSchemaEditing({ id, type, content, graphActions });
  const {
    definitionDrafts,
    definitionChildrenMap,
    rootDefinitions,
    definitionTypeOptions,
    collapsedDefinitionPaths,
    toggleDefinitionCollapsed,
    addDefinition,
    addChildDefinition,
    removeDefinition,
    updateDefinitionName,
    updateDefinitionType,
    updateDefinitionDescription,
    updateDefinitionDefaultValue,
    getDefinitionIndex,
    getDefinitionTypeLabel,
  } = useRequestDefinitionsEditing({
    id,
    content,
    t,
    sourceSchemaValue,
    updateNodeSchema,
  });
  const {
    exampleSources,
    activeSourceIndex,
    setActiveSourceIndex,
    editingSourceIndex,
    setEditingSourceIndex,
    activeSource,
    activeExampleJsonDraft,
    activeDescriptionDraft,
    exampleFieldSummary,
    fileInputRef,
    exampleJsonEditorRef,
    addExampleSource,
    removeExampleSource,
    persistExamples,
    handleExampleJsonChange,
    commitExampleJson,
    handleDescriptionChange,
    commitDescription,
    handleUploadJson,
    handleDownloadJson,
    openSimulatorPanel,
    syncExampleToSimulator,
  } = useRequestExamplesEditing({
    id,
    content,
    t,
    graphActions,
    panels,
    activeGraphTabId,
    simulatorExampleBinding,
    nodeName,
    sourceSchemaValue,
    updateNodeSchema,
    definitionDrafts,
  });

  const renderTabBarExtraContent = () => {
    if (activeTab === RequestTabKey.Examples) {
      return (
        <Space size='small' style={{ marginRight: 8 }}>
          <Button type='text' size='small' disabled={disabled} icon={<PlusOutlined />} onClick={addExampleSource}>
            {t('requestAddDataSource')}
          </Button>
          <Tooltip title={t('requestUploadJsonTooltip')}>
            <Button
              type='text'
              size='small'
              disabled={disabled}
              icon={<CloudUploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('uploadJson')}
            </Button>
          </Tooltip>
          <Tooltip title={t('requestDownloadJsonTooltip')}>
            <Button
              type='text'
              size='small'
              disabled={!activeSource}
              icon={<CloudDownloadOutlined />}
              onClick={handleDownloadJson}
            >
              {t('downloadJson')}
            </Button>
          </Tooltip>
          <Tooltip title={t('requestSimulateTooltip')} placement='bottomRight'>
            <Button
              type='text'
              size='small'
              icon={<PlayCircleOutlined />}
              disabled={disabled || activePanel === 'simulator'}
              onClick={openSimulatorPanel}
            />
          </Tooltip>
        </Space>
      );
    }

    if (activeTab === RequestTabKey.Schema) {
      return (
        <Space size='small' style={{ marginRight: 8 }}>
          <Tooltip title={t('requestFormatSchema')} placement='bottomRight'>
            <Button
              type='text'
              size='small'
              shape='circle'
              icon={<FormatPainterOutlined />}
              onClick={() => schemaEditorRef.current?.getAction?.('editor.action.formatDocument')?.run?.()}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title={t('convertToJsonSchema')} placement='bottomRight'>
            <Button
              type='text'
              size='small'
              shape='circle'
              icon={<ImportOutlined />}
              onClick={() => setJsonToJsonSchemaOpen(true)}
              disabled={disabled}
            />
          </Tooltip>
        </Space>
      );
    }

    return null;
  };

  const themedEditorOptions = useMemo(
    () => ({
      ...editorOptions,
      theme: token.mode === 'dark' ? 'vs-dark' : 'light',
    }),
    [token.mode],
  );

  return (
    <div
      className='grl-node-content'
      data-theme={token.mode}
      style={
        {
          'height': '100%',
          '--color-text': token.colorTextBase,
          '--color-background-elevated': token.colorBgElevated,
          '--color-border': token.colorBorder,
          '--color-border-secondary': token.colorBorderSecondary,
          '--color-fill-secondary': token.colorFillSecondary,
          '--color-fill-tertiary': token.colorFillTertiary,
          '--color-primary-bg': token.colorPrimaryBg,
          '--color-primary-border': token.colorPrimaryBorder,
          '--color-primary-text': token.colorPrimaryText,
        } as React.CSSProperties
      }
    >
      <div className='grl-node-content-main grl-request-tab'>
        <div className='grl-node-content-side'>
          <div className='grl-node-content-side__panel'>
            <div className='grl-node-content-side__header'>
              <Tabs
                rootClassName='grl-inline-tabs'
                size='small'
                style={{ width: '100%' }}
                activeKey={activeTab}
                onChange={(nextKey) => {
                  setActiveTab(nextKey as RequestTabKey);
                }}
                items={[
                  { key: RequestTabKey.Definitions, label: t('requestDefinitionsTab') },
                  { key: RequestTabKey.Examples, label: t('requestExamplesTab') },
                  {
                    key: RequestTabKey.Schema,
                    label: (
                      <span>
                        {t('schema')}
                        <Tooltip title={t('requestSchemaPriorityTooltip')}>
                          <InfoCircleOutlined
                            style={{ fontSize: 10, marginLeft: 4, opacity: 0.5, verticalAlign: 'text-top' }}
                          />
                        </Tooltip>
                      </span>
                    ),
                  },
                ]}
                tabBarExtraContent={renderTabBarExtraContent()}
              />
              <input
                hidden
                accept='application/json'
                type='file'
                ref={fileInputRef}
                onChange={handleUploadJson}
                onClick={(event) => {
                  (event.target as HTMLInputElement).value = '';
                }}
              />
            </div>
            <div className='grl-node-content-side__body'>
              {activeTab === RequestTabKey.Definitions && (
                <RequestDefinitions
                  rootDefinitions={rootDefinitions}
                  childrenMap={definitionChildrenMap}
                  collapsedPaths={collapsedDefinitionPaths}
                  disabled={disabled}
                  definitionTypeOptions={definitionTypeOptions}
                  onAdd={addDefinition}
                  onUpdateName={updateDefinitionName}
                  onUpdateType={updateDefinitionType}
                  onUpdateDescription={updateDefinitionDescription}
                  onUpdateDefaultValue={updateDefinitionDefaultValue}
                  onAddChild={addChildDefinition}
                  onRemove={removeDefinition}
                  onToggleCollapse={toggleDefinitionCollapsed}
                  getDefinitionIndex={getDefinitionIndex}
                />
              )}

              {activeTab === RequestTabKey.Examples && (
                <RequestExamples
                  sources={exampleSources}
                  activeSourceIndex={activeSourceIndex}
                  editingSourceIndex={editingSourceIndex}
                  activeSource={activeSource}
                  activeDescriptionDraft={activeDescriptionDraft}
                  activeJsonDraft={activeExampleJsonDraft}
                  disabled={disabled}
                  definitionDrafts={definitionDrafts}
                  onSourceSelect={(index) => {
                    setActiveSourceIndex(index);
                    syncExampleToSimulator(exampleSources[index], index);
                  }}
                  onSourceAdd={addExampleSource}
                  onSourceRemove={removeExampleSource}
                  onSourceRename={(index, name) => {
                    const trimmedName = name.trim();
                    if (trimmedName) {
                      persistExamples(
                        exampleSources.map((item, currentIndex) =>
                          currentIndex === index ? { ...item, name: trimmedName } : item,
                        ),
                        index,
                        { syncToSimulator: false },
                      );
                    }
                  }}
                  onEnterEditing={(index) => setEditingSourceIndex(index)}
                  onSourceRenameExit={() => setEditingSourceIndex(null)}
                  onDescriptionChange={handleDescriptionChange}
                  onDescriptionCommit={commitDescription}
                  onJsonChange={handleExampleJsonChange}
                  onJsonCommit={commitExampleJson}
                  onFormat={() => exampleJsonEditorRef.current?.getAction?.('editor.action.formatDocument')?.run?.()}
                  jsonEditorRef={exampleJsonEditorRef}
                  summary={exampleFieldSummary}
                  getDefinitionTypeLabel={getDefinitionTypeLabel}
                  editorOptions={themedEditorOptions}
                />
              )}

              {activeTab === RequestTabKey.Schema && (
                <RequestSchemaEditor
                  schemaDraft={schemaDraft}
                  disabled={disabled}
                  onSchemaChange={handleSchemaDraftChange}
                  onSchemaCommit={commitSchemaDraft}
                  onFormat={() => schemaEditorRef.current?.getAction?.('editor.action.formatDocument')?.run?.()}
                  jsonToJsonSchemaOpen={jsonToJsonSchemaOpen}
                  onOpenConvert={() => setJsonToJsonSchemaOpen(true)}
                  onConvertSuccess={handleConvertToJsonSchemaSuccess}
                  onDismissConvert={() => setJsonToJsonSchemaOpen(false)}
                  editorRef={schemaEditorRef}
                  editorOptions={themedEditorOptions}
                  nodeId={id}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
