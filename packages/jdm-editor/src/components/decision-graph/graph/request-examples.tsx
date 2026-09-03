import { CommentOutlined, DeleteOutlined, FormatPainterOutlined, PlusOutlined } from '@/icons';
import { Editor } from '@monaco-editor/react';
import type * as monacoModule from 'monaco-editor';
import type { editor } from 'monaco-editor';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { RequestDefinition, RequestDefinitionType, RequestExampleSource } from '../../../helpers/request-schema';
import { useT } from '../../../theming/i18n';
import { AutosizeTextArea } from '../../autosize-text-area';
import { Button, Card, Popconfirm, Tooltip, Typography } from '../../primitives';
import { BlurCommitInput } from './blur-commit-input';
import { RequestExampleSummary, type RequestExampleSummaryData } from './request-example-summary';
import { registerJsonInlayHintsProvider } from './request-inlay-hints';

export type RequestExamplesProps = {
  sources: RequestExampleSource[];
  activeSourceIndex: number;
  editingSourceIndex: number | null;
  activeSource: RequestExampleSource | null;
  activeDescriptionDraft: string;
  activeJsonDraft: string;
  disabled: boolean;
  definitionDrafts: RequestDefinition[];
  onSourceSelect: (index: number) => void;
  onSourceAdd: () => void;
  onSourceRemove: (index: number) => void;
  onSourceRename: (index: number, name: string) => void;
  onEnterEditing: (index: number) => void;
  onSourceRenameExit: () => void;
  onDescriptionChange: (value: string) => void;
  onDescriptionCommit: () => void;
  onJsonChange: (value: string) => void;
  onJsonCommit: () => void;
  onFormat: () => void;
  onJsonEditorMount: (instance: editor.IStandaloneCodeEditor) => void;
  summary: RequestExampleSummaryData | null;
  getDefinitionTypeLabel: (type: RequestDefinitionType) => string;
  editorOptions: Record<string, unknown>;
};

export const RequestExamples: React.FC<RequestExamplesProps> = ({
  sources,
  activeSourceIndex,
  editingSourceIndex,
  activeSource,
  activeDescriptionDraft,
  activeJsonDraft,
  disabled,
  definitionDrafts,
  onSourceSelect,
  onSourceAdd,
  onSourceRemove,
  onSourceRename,
  onEnterEditing,
  onSourceRenameExit,
  onDescriptionChange,
  onDescriptionCommit,
  onJsonChange,
  onJsonCommit,
  onFormat,
  onJsonEditorMount,
  summary,
  getDefinitionTypeLabel,
  editorOptions,
}) => {
  const t = useT();
  const [inlayHintsEnabled, setInlayHintsEnabled] = useState(true);
  const blurDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const inlayHintsDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const inlayHintsEnabledRef = useRef(inlayHintsEnabled);
  const monacoInstanceRef = useRef<typeof monacoModule | null>(null);
  const inlayHintsModelRef = useRef<editor.ITextModel | null>(null);
  const onJsonCommitRef = useRef(onJsonCommit);
  const definitionDraftsRef = useRef(definitionDrafts);

  useEffect(() => {
    inlayHintsEnabledRef.current = inlayHintsEnabled;
  }, [inlayHintsEnabled]);

  const syncInlayHintsProvider = useCallback(() => {
    inlayHintsDisposableRef.current?.dispose();
    inlayHintsDisposableRef.current = null;

    const model = inlayHintsModelRef.current;
    const monacoInstance = monacoInstanceRef.current;
    if (inlayHintsEnabledRef.current && monacoInstance && model) {
      inlayHintsDisposableRef.current = registerJsonInlayHintsProvider(
        monacoInstance,
        model,
        () => definitionDraftsRef.current,
      );
    }
  }, []);

  useEffect(() => {
    syncInlayHintsProvider();
  }, [inlayHintsEnabled, syncInlayHintsProvider]);

  useEffect(() => {
    onJsonCommitRef.current = onJsonCommit;
  });

  useEffect(() => {
    definitionDraftsRef.current = definitionDrafts;
  });

  useEffect(() => {
    return () => {
      blurDisposableRef.current?.dispose();
      blurDisposableRef.current = null;
      inlayHintsDisposableRef.current?.dispose();
      inlayHintsDisposableRef.current = null;
    };
  }, []);

  if (sources.length === 0) {
    return (
      <div className='flex h-full min-h-0 flex-col'>
        <Card className='rounded-xl'>
          <div className='flex flex-col items-center gap-3 py-10 text-xs text-muted-foreground'>
            <span>{t('request.noDataSources')}</span>
            <Button type='primary' icon={<PlusOutlined />} disabled={disabled} onClick={onSourceAdd}>
              {t('request.createDataSource')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex min-h-0 flex-1 gap-4'>
        <div className='flex w-[220px] shrink-0 flex-col gap-2 overflow-y-auto'>
          {sources.map((source, index) => (
            <div
              key={source.id}
              role='button'
              tabIndex={disabled ? -1 : 0}
              aria-pressed={index === activeSourceIndex}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors ${
                index === activeSourceIndex ? 'border-primary/40 bg-primary/10' : 'border-transparent hover:bg-muted/60'
              }`}
              onClick={() => {
                onSourceSelect(index);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSourceSelect(index);
                }
              }}
            >
              <div
                className='min-w-0 flex-1'
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (!disabled) {
                    onEnterEditing(index);
                  }
                }}
              >
                {editingSourceIndex === index ? (
                  <BlurCommitInput
                    disabled={disabled}
                    value={source.name}
                    blurBehavior='cancel'
                    saveLabel={t('request.save')}
                    cancelLabel={t('common.cancel')}
                    showActions={true}
                    onCommit={(nextName) => {
                      const trimmedName = nextName.trim();
                      if (trimmedName) {
                        onSourceRename(index, trimmedName);
                      }
                    }}
                    onExit={onSourceRenameExit}
                  />
                ) : (
                  <Tooltip title={source.description ? `${source.name} — ${source.description}` : source.name}>
                    <Typography.Text className='block truncate'>{source.name}</Typography.Text>
                  </Tooltip>
                )}
              </div>
              <Popconfirm
                title={t('request.deleteDataSourceConfirm')}
                okText={t('common.delete')}
                cancelText={t('common.cancel')}
                onConfirm={() => onSourceRemove(index)}
              >
                <Button
                  danger
                  type='text'
                  size='small'
                  disabled={disabled}
                  icon={<DeleteOutlined />}
                  onClick={(event) => event.stopPropagation()}
                />
              </Popconfirm>
            </div>
          ))}
          <Tooltip title={t('request.addDataSource')} placement='bottom'>
            <Button type='dashed' size='small' disabled={disabled} icon={<PlusOutlined />} onClick={onSourceAdd} />
          </Tooltip>
        </div>

        <div className='flex h-full min-h-0 flex-1 flex-col gap-1.5'>
          <div className='flex items-center justify-between gap-2'>
            <Typography.Text strong className='truncate'>
              {activeSource?.name}
            </Typography.Text>
            <div className='flex items-center gap-1'>
              <Tooltip title={t('request.toggleFieldDescriptionsTooltip')} placement='bottomRight'>
                <Button
                  type='text'
                  size='small'
                  shape='circle'
                  icon={<CommentOutlined />}
                  className={inlayHintsEnabled ? 'text-primary' : undefined}
                  onClick={() => setInlayHintsEnabled((prev) => !prev)}
                  disabled={disabled}
                />
              </Tooltip>
              <Tooltip title={t('common.format')} placement='bottomRight'>
                <Button
                  type='text'
                  size='small'
                  shape='circle'
                  icon={<FormatPainterOutlined />}
                  onClick={onFormat}
                  disabled={disabled}
                />
              </Tooltip>
            </div>
          </div>
          <AutosizeTextArea
            className='rounded-md border border-border px-2 py-1 text-xs'
            value={activeDescriptionDraft}
            onChange={(event) => onDescriptionChange(event.target.value)}
            onBlur={onDescriptionCommit}
            placeholder={t('request.exampleDescriptionPlaceholder')}
            disabled={disabled}
            maxRows={4}
          />
          <div className='min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-card'>
            <Editor
              height='100%'
              language='json'
              value={activeJsonDraft}
              onMount={(instance, monacoInstance) => {
                blurDisposableRef.current?.dispose();
                blurDisposableRef.current = instance.onDidBlurEditorText(() => {
                  onJsonCommitRef.current();
                });

                const model = instance.getModel();
                monacoInstanceRef.current = monacoInstance;
                inlayHintsModelRef.current = model;
                syncInlayHintsProvider();
                onJsonEditorMount(instance);
              }}
              onChange={(value) => onJsonChange(value ?? '')}
              theme={(editorOptions as { theme?: string })?.theme ?? 'light'}
              options={{
                ...editorOptions,
                readOnly: disabled,
                inlayHints: {
                  enabled: inlayHintsEnabled ? 'on' : 'off',
                },
              }}
            />
          </div>
          <RequestExampleSummary summary={summary} getDefinitionTypeLabel={getDefinitionTypeLabel} />
        </div>
      </div>
    </div>
  );
};
