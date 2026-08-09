import { DeleteOutlined, FormatPainterOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, Popconfirm, Tooltip, Typography } from 'antd';
import { Editor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import React, { useEffect, useRef } from 'react';

import { BlurCommitInput } from './blur-commit-input';
import { registerJsonInlayHintsProvider } from './request-inlay-hints';
import { RequestExampleSummary, type RequestExampleSummaryData } from './request-example-summary';
import type { RequestDefinition, RequestDefinitionType, RequestExampleSource } from '../../../helpers/request-schema';
import { useTranslation } from '../../../locales';

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
  jsonEditorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | undefined>;
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
  jsonEditorRef,
  summary,
  getDefinitionTypeLabel,
  editorOptions,
}) => {
  const { t } = useTranslation();
  const blurDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const inlayHintsDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const onJsonCommitRef = useRef(onJsonCommit);
  const definitionDraftsRef = useRef(definitionDrafts);

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
      <div className='grl-request-tab__body grl-request-tab__body--examples'>
        <Card className='grl-request-tab__surface'>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('requestNoDataSources')}
          >
            <Button type='primary' icon={<PlusOutlined />} disabled={disabled} onClick={onSourceAdd}>
              {t('requestCreateDataSource')}
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div className='grl-request-tab__body grl-request-tab__body--examples'>
      <div className='grl-request-tab__examples-split'>
        <div className='grl-request-tab__examples-source-list'>
          {sources.map((source, index) => (
            <div
              key={source.id}
              className={`grl-request-tab__examples-source-item ${
                index === activeSourceIndex ? 'grl-request-tab__examples-source-item--active' : ''
              }`}
              onClick={() => {
                onSourceSelect(index);
              }}
            >
              <div
                className='grl-request-tab__examples-source-item__name'
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
                    saveLabel={t('save')}
                    cancelLabel={t('cancel')}
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
                  <Tooltip
                    title={
                      source.description ? (
                        <div>
                          <div>{source.name}</div>
                          <div style={{ marginTop: 4, opacity: 0.85, fontSize: 12 }}>
                            {source.description}
                          </div>
                        </div>
                      ) : null
                    }
                  >
                    <Typography.Text ellipsis>
                      {source.name}
                    </Typography.Text>
                  </Tooltip>
                )}
              </div>
              <Popconfirm
                title={t('requestDeleteDataSourceConfirm')}
                okText={t('delete')}
                cancelText={t('cancel')}
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
          <Tooltip title={t('requestAddDataSource')} placement='bottom'>
            <Button
              type='dashed'
              size='small'
              disabled={disabled}
              icon={<PlusOutlined />}
              onClick={onSourceAdd}
              className='grl-request-tab__examples-add-source-button'
            />
          </Tooltip>
        </div>

        <div className='grl-request-tab__example-editor'>
          <div className='grl-request-tab__example-editor__header'>
            <Typography.Text strong ellipsis={{ tooltip: activeSource?.name }}>
              {activeSource?.name}
            </Typography.Text>
            <Tooltip title={t('format')} placement='bottomRight'>
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
          <Input.TextArea
            className='grl-request-tab__example-description'
            value={activeDescriptionDraft}
            onChange={(event) => onDescriptionChange(event.target.value)}
            onBlur={onDescriptionCommit}
            placeholder={t('requestExampleDescriptionPlaceholder')}
            disabled={disabled}
            autoSize={{ minRows: 1, maxRows: 4 }}
          />
          <div className='grl-request-tab__example-json'>
            <Editor
              height='100%'
              language='json'
              value={activeJsonDraft}
              onMount={(instance, monacoInstance) => {
                jsonEditorRef.current = instance;
                blurDisposableRef.current?.dispose();
                blurDisposableRef.current = instance.onDidBlurEditorText(() => {
                  onJsonCommitRef.current();
                });

                const model = instance.getModel();
                if (model) {
                  inlayHintsDisposableRef.current?.dispose();
                  inlayHintsDisposableRef.current = registerJsonInlayHintsProvider(
                    monacoInstance,
                    model,
                    () => definitionDraftsRef.current,
                  );
                }
              }}
              onChange={(value) => onJsonChange(value ?? '')}
              theme={(editorOptions as any)?.theme ?? 'light'}
              options={{
                ...editorOptions,
                readOnly: disabled,
                inlayHints: {
                  enabled: 'on',
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
