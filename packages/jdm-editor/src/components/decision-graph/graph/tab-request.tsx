import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  FormatPainterOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '#icons';
import InformationIcon from '#reui/icons/animated/outline/information';
import type { DragDropManager } from 'dnd-core';
import type { editor } from 'monaco-editor';
import React, { useMemo, useRef, useState } from 'react';

import '../../../helpers/monaco';
import { useThemeMode } from '../../../theme';
import { useT } from '../../../theming/i18n';
import { Button, Space, Tabs, Tooltip } from '../../primitives';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { RequestDefinitions } from './request-definitions';
import { RequestExamples } from './request-examples';
import { RequestSchemaEditor } from './request-schema-editor';
import { useRequestDefinitionsEditing } from './use-request-definitions-editing';
import { useRequestExamplesEditing } from './use-request-examples-editing';
import { useRequestSchemaEditing } from './use-request-schema-editing';

export type TabRequestProps = {
  id: string;
  manager?: DragDropManager;
  menuList?: unknown[];
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
  const t = useT();
  const mode = useThemeMode();
  const graphActions = useDecisionGraphActions();
  const [activeTab, setActiveTab] = useState<RequestTabKey>(RequestTabKey.Definitions);
  const schemaEditorRef = useRef<editor.IStandaloneCodeEditor | undefined>(undefined);
  const exampleJsonEditorRef = useRef<editor.IStandaloneCodeEditor | undefined>(undefined);

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
        <Space size='small' className='mr-2'>
          <Button type='text' size='small' disabled={disabled} icon={<PlusOutlined />} onClick={addExampleSource}>
            {t('request.addDataSource')}
          </Button>
          <Tooltip title={t('request.uploadJsonTooltip')}>
            <Button
              type='text'
              size='small'
              disabled={disabled}
              icon={<CloudUploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('dg.toolbar.uploadJson')}
            </Button>
          </Tooltip>
          <Tooltip title={t('request.downloadJsonTooltip')}>
            <Button
              type='text'
              size='small'
              disabled={!activeSource}
              icon={<CloudDownloadOutlined />}
              onClick={handleDownloadJson}
            >
              {t('dg.toolbar.downloadJson')}
            </Button>
          </Tooltip>
          <Tooltip title={t('request.simulateTooltip')} placement='bottomRight'>
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
        <Space size='small' className='mr-2'>
          <Tooltip title={t('request.formatSchema')} placement='bottomRight'>
            <Button
              type='text'
              size='small'
              shape='circle'
              icon={<FormatPainterOutlined />}
              onClick={() => {
                const formatAction = schemaEditorRef.current?.getAction?.('editor.action.formatDocument');
                formatAction?.run();
              }}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title={t('dg.jsonSchema.title')} placement='bottomRight'>
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
      theme: mode === 'dark' ? 'vs-dark' : 'light',
    }),
    [mode],
  );

  return (
    <div className='relative box-border flex h-full flex-col overflow-hidden bg-[var(--card)]'>
      <div className='flex shrink-0 items-center border-b border-b-border px-3'>
        <Tabs
          size='small'
          className='w-full'
          activeKey={activeTab}
          onChange={(nextKey) => {
            setActiveTab(nextKey as RequestTabKey);
          }}
          items={[
            { key: RequestTabKey.Definitions, label: t('request.definitionsTab') },
            { key: RequestTabKey.Examples, label: t('request.examplesTab') },
            {
              key: RequestTabKey.Schema,
              label: (
                <span>
                  {t('request.schema')}
                  <Tooltip title={t('request.schemaPriorityTooltip')}>
                    <span className='ml-1 inline-flex align-super opacity-50 [&_svg]:block'>
                      <InformationIcon className='size-2.5' />
                    </span>
                  </Tooltip>
                </span>
              ),
            },
          ]}
          tabBarExtraContent={renderTabBarExtraContent()}
        />
      </div>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden p-3'>
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
          <React.Fragment>
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
              onFormat={() => {
                const formatAction = exampleJsonEditorRef.current?.getAction?.('editor.action.formatDocument');
                formatAction?.run();
              }}
              onJsonEditorMount={(instance) => {
                exampleJsonEditorRef.current = instance;
              }}
              summary={exampleFieldSummary}
              getDefinitionTypeLabel={getDefinitionTypeLabel}
              editorOptions={themedEditorOptions}
            />
          </React.Fragment>
        )}

        {activeTab === RequestTabKey.Schema && (
          <RequestSchemaEditor
            schemaDraft={schemaDraft}
            disabled={disabled}
            onSchemaChange={handleSchemaDraftChange}
            onSchemaCommit={commitSchemaDraft}
            jsonToJsonSchemaOpen={jsonToJsonSchemaOpen}
            onConvertSuccess={handleConvertToJsonSchemaSuccess}
            onDismissConvert={() => setJsonToJsonSchemaOpen(false)}
            onEditorMount={(instance) => {
              schemaEditorRef.current = instance;
            }}
            editorOptions={themedEditorOptions}
            nodeId={id}
          />
        )}
      </div>
    </div>
  );
};
