import { DeleteOutlined, DownOutlined } from '#icons';
import InformationIcon from '#reui/icons/animated/outline/information';
import type { DragDropManager } from 'dnd-core';
import type { editor } from 'monaco-editor';
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';

import { saveFile } from '../../../helpers/file-helpers';
import '../../../helpers/monaco';
import {
  type RequestContentLike,
  exportInputContractEnvelope,
  parseInputContractEnvelope,
  writeRequestInputContract,
} from '../../../helpers/request-schema';
import { useT } from '../../../theming/i18n';
import { Button, Popconfirm, Tooltip } from '../../primitives';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { RequestSchemaEditor } from './request-schema-editor';
import { useRequestSessionDraftSerializer } from './request-session-draft';
import { SplitEditor } from './request-split-editor';
import { SchemaToolbarActions, useThemedSchemaEditorOptions } from './schema-editor-shared';
import { useRequestDefinitionsEditing } from './use-request-definitions-editing';
import { useRequestExamplesEditing } from './use-request-examples-editing';
import { useRequestSchemaEditing } from './use-request-schema-editing';

export type TabRequestProps = {
  id: string;
  manager?: DragDropManager;
  menuList?: unknown[];
  type?: string;
};

type RequestEditorMode = 'design' | 'code';

/** 旧会话草稿 activeTab → 新模式映射（legacy：schema→Code，其余→Design） */
const toEditorMode = (raw: string): RequestEditorMode => (raw === 'schema' || raw === 'code' ? 'code' : 'design');

export const TabRequest: React.FC<TabRequestProps> = ({ id, type }) => {
  const t = useT();
  const graphActions = useDecisionGraphActions();
  const [mode, setMode] = useState<RequestEditorMode>('design');
  const [selectedFieldPath, setSelectedFieldPath] = useState<string | null>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const schemaEditorRef = useRef<editor.IStandaloneCodeEditor | undefined>(undefined);
  const exampleJsonEditorRef = useRef<editor.IStandaloneCodeEditor | undefined>(undefined);
  const contractFileInputRef = useRef<HTMLInputElement>(null);

  const {
    disabled: disabledRaw,
    content,
    nodeName,
    panels,
    activePanel,
    activeGraphTabId,
    simulatorExampleBinding,
    fixturesRunner,
    fixturesRun,
  } = useDecisionGraphState(
    ({
      disabled,
      decisionGraph,
      panels,
      activePanel,
      activeTab,
      simulatorExampleBinding,
      fixturesRunner,
      fixturesRun,
    }) => ({
      disabled,
      content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content,
      nodeName: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.name ?? t('request'),
      panels,
      activePanel,
      activeGraphTabId: activeTab,
      simulatorExampleBinding,
      fixturesRunner,
      fixturesRun,
    }),
  );
  const disabled = disabledRaw ?? false;

  const {
    contract,
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
    exampleDriftStates,
    activeSourceIndex,
    setActiveSourceIndex,
    activeSource,
    activeExampleJsonDraft,
    activeDescriptionDraft,
    exampleFieldSummary,
    fileInputRef,
    addExampleSource,
    removeExampleSource,
    persistExamples,
    migrateExample,
    migrateAllExamples,
    confirmExampleValid,
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
    definitionDrafts,
  });

  // UI 会话草稿快照：activeTab 字段承载 mode（旧草稿 schema→Code，其余→Design 降级映射）
  useRequestSessionDraftSerializer(
    id,
    {
      activeTab: mode,
      schemaDraft,
      activeSourceIndex,
      activeExampleJsonDraft,
      activeDescriptionDraft,
    },
    {
      setActiveTab: (tab) => setMode(toEditorMode(tab)),
      setSchemaDraft: handleSchemaDraftChange,
      setActiveExampleJsonDraft: handleExampleJsonChange,
      setActiveDescriptionDraft: handleDescriptionChange,
      setActiveSourceIndex: setActiveSourceIndex,
    },
  );

  // 契约信封导入/导出（ADR-013 清单 #7）
  const hasContract = Object.keys(contract.schema ?? {}).length > 0 || contract.examples.length > 0;

  const handleExportContract = () => {
    const baseName =
      (nodeName ?? '')
        .replace(/\.json$/i, '')
        .replace(/[\\/:*?"<>|]/g, '-')
        .trim() || t('request');
    const envelope = exportInputContractEnvelope(contract);
    saveFile(`${baseName}-contract.json`, new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }));
  };

  const handleImportContractFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const result = parseInputContractEnvelope(await file.text());

      if (!result.ok) {
        toast.error(
          result.error === 'unsupported-version'
            ? t('request.importContractUnsupportedVersion')
            : result.error === 'invalid-shape'
              ? t('request.importContractInvalidShape')
              : t('request.importContractInvalidJson'),
        );
        return;
      }

      const existingIds = new Set(contract.examples.map((example) => example.id));
      const examples = result.contract.examples.map((example) =>
        !example.id || existingIds.has(example.id) ? { ...example, id: crypto.randomUUID() } : example,
      );

      graphActions.updateNode(id, (draft) => {
        draft.content ??= {};
        writeRequestInputContract(draft.content as RequestContentLike & Record<string, any>, {
          ...result.contract,
          examples,
        });
        return draft;
      });
      toast.success(t('request.importContractSuccess'));
    } catch (error: any) {
      console.warn('[request-node] failed to import contract envelope', { nodeId: id, error });
      toast.error(error?.message || t('request.importContractInvalidJson'));
    } finally {
      event.target.value = '';
    }
  };

  const themedEditorOptions = useThemedSchemaEditorOptions();
  const activeDriftState = activeSource ? exampleDriftStates[activeSource.id] : undefined;
  const activeDriftCount = activeDriftState
    ? activeDriftState.drift.missing.length +
      activeDriftState.drift.extra.length +
      activeDriftState.drift.conflicts.length +
      activeDriftState.constraintIssues.length
    : 0;
  const hasAnyDriftedExample = exampleSources.some((source) => {
    const state = exampleDriftStates[source.id];
    return Boolean(
      state &&
        (state.schemaChanged ||
          state.drift.missing.length +
            state.drift.extra.length +
            state.drift.conflicts.length +
            state.constraintIssues.length >
            0),
    );
  });

  const renderToolbar = () => {
    if (mode === 'code') {
      return (
        <SchemaToolbarActions
          tab='schema'
          disabled={disabled}
          onFormat={() => {
            const formatAction = schemaEditorRef.current?.getAction?.('editor.action.formatDocument');
            formatAction?.run();
          }}
          onConvertFromJson={() => setJsonToJsonSchemaOpen(true)}
        />
      );
    }

    return (
      <SchemaToolbarActions
        tab='examples'
        disabled={disabled}
        onUploadJson={() => fileInputRef.current?.click()}
        onDownloadJson={handleDownloadJson}
        hasActiveSource={Boolean(activeSource)}
        onImportContract={() => contractFileInputRef.current?.click()}
        onExportContract={handleExportContract}
        hasContract={hasContract}
        onRunAll={fixturesRunner ? () => graphActions.runFixtures() : undefined}
        runAllRunning={fixturesRun?.status === 'running'}
        onSimulate={openSimulatorPanel}
        simulateDisabled={activePanel === 'simulator'}
      />
    );
  };

  return (
    <div className='relative box-border flex h-full flex-col overflow-hidden bg-[var(--card)]'>
      {/* 顶栏：模式切换 + Examples 切换器 + 工具栏 */}
      <div className='flex shrink-0 items-center gap-2 border-b border-b-border px-3 py-1.5'>
        <div className='flex items-center rounded-md border border-border p-0.5'>
          <Tooltip title={t('request.designModeTooltip')}>
            <Button
              type='text'
              size='small'
              className={`!px-2 ${mode === 'design' ? 'bg-primary/10' : 'opacity-60'}`}
              onClick={() => setMode('design')}
            >
              {t('request.modeDesign')}
            </Button>
          </Tooltip>
          <Tooltip title={t('request.schemaPriorityTooltip')}>
            <Button
              type='text'
              size='small'
              className={`!px-2 ${mode === 'code' ? 'bg-primary/10' : 'opacity-60'}`}
              onClick={() => setMode('code')}
            >
              {t('request.modeCode')}
              <InformationIcon className='ml-1 size-2.5 opacity-50 [&_svg]:block' />
            </Button>
          </Tooltip>
        </div>

        {mode === 'design' && (
          <div className='relative'>
            <Button type='text' size='small' className='!px-2' onClick={() => setExamplesOpen((open) => !open)}>
              <span className='max-w-[140px] truncate'>{activeSource?.name ?? t('request.examplesSwitcherLabel')}</span>
              {activeDriftCount > 0 && <span className='ml-1 inline-block size-1.5 rounded-full bg-amber-500' />}
              <DownOutlined style={{ fontSize: 10 }} className='ml-1 opacity-60' />
            </Button>
            {examplesOpen && (
              <>
                <div className='fixed inset-0 z-20' onClick={() => setExamplesOpen(false)} />
                <div className='absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-border bg-[var(--card)] shadow-md'>
                  <div className='max-h-56 overflow-y-auto py-1'>
                    {exampleSources.map((source, index) => {
                      const driftState = exampleDriftStates[source.id];
                      const driftCount = driftState
                        ? driftState.drift.missing.length +
                          driftState.drift.extra.length +
                          driftState.drift.conflicts.length +
                          driftState.constraintIssues.length
                        : 0;

                      return (
                        <div
                          key={source.id}
                          role='button'
                          tabIndex={0}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors ${
                            index === activeSourceIndex ? 'bg-primary/10' : 'hover:bg-muted/60'
                          }`}
                          onClick={() => {
                            setActiveSourceIndex(index);
                            syncExampleToSimulator(source, index);
                            setExamplesOpen(false);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setActiveSourceIndex(index);
                              setExamplesOpen(false);
                            }
                          }}
                        >
                          <span className='min-w-0 flex-1 truncate'>{source.name}</span>
                          {driftCount > 0 && (
                            <span className='inline-block size-1.5 shrink-0 rounded-full bg-amber-500' />
                          )}
                          <Popconfirm
                            title={t('request.deleteDataSourceConfirm')}
                            okText={t('common.delete')}
                            cancelText={t('common.cancel')}
                            onConfirm={() => {
                              removeExampleSource(index);
                              setExamplesOpen(false);
                            }}
                          >
                            <Button
                              danger
                              type='text'
                              size='small'
                              className='!h-5 !w-5 !p-0'
                              disabled={disabled}
                              icon={<DeleteOutlined />}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </Popconfirm>
                        </div>
                      );
                    })}
                    {exampleSources.length === 0 && (
                      <div className='px-2.5 py-2 text-xs opacity-60'>{t('request.noDataSources')}</div>
                    )}
                  </div>
                  <div className='flex items-center justify-between border-t border-border px-2 py-1.5'>
                    <Button
                      type='link'
                      size='small'
                      className='!px-1'
                      disabled={disabled}
                      onClick={() => {
                        addExampleSource();
                        setExamplesOpen(false);
                      }}
                    >
                      {t('request.addDataSource')}
                    </Button>
                    {hasAnyDriftedExample && exampleSources.length > 0 && (
                      <Button
                        type='link'
                        size='small'
                        className='!px-1'
                        disabled={disabled}
                        onClick={() => {
                          migrateAllExamples();
                          setExamplesOpen(false);
                        }}
                      >
                        {t('request.driftMigrateAll')}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className='ml-auto'>{renderToolbar()}</div>
      </div>

      <div className='flex min-h-0 flex-1 flex-col overflow-hidden p-3'>
        {mode === 'code' ? (
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
        ) : (
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
            <SplitEditor
              disabled={disabled}
              rootDefinitions={rootDefinitions}
              childrenMap={definitionChildrenMap}
              definitionTypeOptions={definitionTypeOptions}
              selectedPath={selectedFieldPath}
              onSelectField={setSelectedFieldPath}
              onAddField={addDefinition}
              onAddChild={addChildDefinition}
              onUpdateName={updateDefinitionName}
              onUpdateType={updateDefinitionType}
              onUpdateDefaultValue={updateDefinitionDefaultValue}
              onUpdateDescription={updateDefinitionDescription}
              onRemoveField={removeDefinition}
              getDefinitionIndex={getDefinitionIndex}
              exampleSources={exampleSources}
              activeExampleIndex={activeSourceIndex}
              activeExampleJsonDraft={activeExampleJsonDraft}
              activeDescriptionDraft={activeDescriptionDraft}
              exampleFieldSummary={exampleFieldSummary}
              driftStates={exampleDriftStates}
              onDescriptionChange={handleDescriptionChange}
              onDescriptionCommit={commitDescription}
              onExampleJsonChange={handleExampleJsonChange}
              onExampleJsonCommit={commitExampleJson}
              onFormatExample={() => {
                const formatAction = exampleJsonEditorRef.current?.getAction?.('editor.action.formatDocument');
                formatAction?.run();
              }}
              onExampleJsonEditorMount={(instance) => {
                exampleJsonEditorRef.current = instance;
              }}
              onMigrateActive={() => migrateExample(activeSourceIndex)}
              onConfirmActive={() => confirmExampleValid(activeSourceIndex)}
              onRenameActive={(nextName) => {
                const trimmed = nextName.trim();
                if (!trimmed) {
                  return;
                }
                persistExamples(
                  exampleSources.map((source, index) =>
                    index === activeSourceIndex ? { ...source, name: trimmed } : source,
                  ),
                  activeSourceIndex,
                  { syncToSimulator: false },
                );
              }}
              getDefinitionTypeLabel={getDefinitionTypeLabel}
              exampleEditorOptions={themedEditorOptions}
            />
          </React.Fragment>
        )}
      </div>

      <input
        hidden
        accept='application/json'
        type='file'
        ref={contractFileInputRef}
        onChange={handleImportContractFile}
        onClick={(event) => {
          (event.target as HTMLInputElement).value = '';
        }}
      />
    </div>
  );
};
