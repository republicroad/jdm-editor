import { FormatPainterOutlined, ImportOutlined } from '@/icons';
import InformationIcon from '@/reui/icons/animated/outline/information';
import { DiffEditor, Editor } from '@monaco-editor/react';
import { Button, Space, Spin, Tabs, Tooltip } from '../../primitives';
import { useThemeMode } from '../../../theme';
import { type editor } from 'monaco-editor';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanelGroup } from 'react-resizable-panels';
import { match } from 'ts-pattern';
import { useThrottledCallback } from 'use-debounce';

import { useDecisionGraphActions, useDecisionGraphState, useNodeDiff } from '../context/dg-store.context';
import { useTabSerializer } from '../context/serializer.context';
import { JsonToJsonSchemaDialog } from './json-to-json-schema-dialog';

const schemaTooltip = 'Provide JSON Schema format. If no JSON Schema is provided, validation will be skipped.';

const monacoOptions: editor.IStandaloneEditorConstructionOptions = {
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

enum TabKey {
  Schema = 'Schema',
}

export type TabJsonSchemaProps = {
  id: string;
  type?: 'input' | 'output';
};

export const TabJsonSchema: React.FC<TabJsonSchemaProps> = ({ id, type = 'input' }) => {
  const graphActions = useDecisionGraphActions();

  const language = 'json';

  const mode = useThemeMode();

  const [jsonToJsonSchemaOpen, setJsonToJsonSchemaOpen] = useState(false);

  const [activeTab, setActiveTab] = useState(TabKey.Schema);

  const [editor, setEditor] = useState<editor.IStandaloneCodeEditor>();
  const [diffEditor, setDiffEditor] = useState<editor.IStandaloneDiffEditor>();
  const pendingViewStateRef = useRef<editor.ICodeEditorViewState | null>(null);
  const resizeEditor = useThrottledCallback(() => editor?.layout(), 100, { trailing: true });
  const resizeDiffEditor = useThrottledCallback(() => diffEditor?.layout(), 100, { trailing: true });

  useTabSerializer<editor.ICodeEditorViewState | null>(id, 'monaco', {
    serialize: () => editor?.saveViewState() ?? pendingViewStateRef.current ?? null,
    restore: (state) => {
      if (!state) return;
      if (editor) {
        editor.restoreViewState(state);
      } else {
        pendingViewStateRef.current = state;
      }
    },
  });

  useEffect(() => {
    if (editor && pendingViewStateRef.current) {
      editor.restoreViewState(pendingViewStateRef.current);
      pendingViewStateRef.current = null;
    }
  }, [editor]);

  const { disabled, content } = useDecisionGraphState(({ simulate, disabled, decisionGraph }) => ({
    nodeError: match(simulate)
      .with({ error: { data: { nodeId: id } } }, ({ error }) => error)
      .otherwise(() => null),
    disabled,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content,
  }));

  const { contentDiff } = useNodeDiff(id);

  const previousValue = useMemo(() => {
    return contentDiff?.fields?.schema?.previousValue;
  }, [contentDiff]);

  useEffect(() => {
    window.addEventListener('resize', resizeEditor);
    return () => window.removeEventListener('resize', resizeEditor);
  }, [resizeEditor, editor]);

  useEffect(() => {
    window.addEventListener('resize', resizeDiffEditor);
    return () => window.removeEventListener('resize', resizeDiffEditor);
  }, [resizeDiffEditor, diffEditor]);

  return (
    <div
      className='relative box-border flex flex-col'
      data-theme={mode}
      style={
        {
          'height': '100%',
          '--color-text': 'var(--grl-color-text-base)',
          '--color-background-elevated': 'var(--card)',
          '--color-border': 'var(--border)',
          '--line-height': 1.5,
        } as React.CSSProperties
      }
    >
      <PanelGroup
        className='flex-1'
        direction='horizontal'
        autoSaveId={`jdm-editor:${type}:schema:layout`}
      >
        <div className='h-full w-full'>
          <div className='flex h-full flex-col overflow-hidden bg-[var(--card)]'>
            <div className='flex shrink-0 items-center border-b border-b-[var(--border)] bg-[var(--grl-color-primary-bg-fade)]'>
              <Tabs
                rootClassName='grl-inline-tabs'
                size='small'
                style={{ width: '100%' }}
                items={Object.values(TabKey).map((t) => ({
                  key: t,
                  label: (
                    <span>
                      {t}{' '}
                      <Tooltip title={schemaTooltip}>
                        <span className='ml-1 inline-flex align-super opacity-50 [&_svg]:block'>
                          <InformationIcon className='size-2.5' />
                        </span>
                      </Tooltip>
                    </span>
                  ),
                }))}
                activeKey={activeTab}
                onChange={(t) => setActiveTab(t as TabKey)}
                tabBarExtraContent={
                  <Space style={{ marginRight: 8 }} size={'small'}>
                    <Tooltip title='Format code' placement='bottomRight'>
                      <Button
                        size='small'
                        type='text'
                        disabled={disabled}
                        icon={<FormatPainterOutlined />}
                        onClick={() => editor?.getAction?.('editor.action.formatDocument')?.run?.()}
                      />
                    </Tooltip>
                    <Tooltip title='Import from JSON' placement='bottomRight'>
                      <Button
                        type='text'
                        size={'small'}
                        disabled={disabled}
                        icon={<ImportOutlined />}
                        onClick={() => {
                          setJsonToJsonSchemaOpen(true);
                        }}
                      />
                    </Tooltip>
                  </Space>
                }
              />
            </div>
            <div className='grow overflow-y-auto'>
              {match(activeTab)
                .with(TabKey.Schema, () =>
                  previousValue !== undefined ? (
                    <DiffEditor
                      loading={<Spin size='large' />}
                      language={language}
                      original={previousValue}
                      modified={content?.schema}
                      onMount={(editor) => setDiffEditor(editor)}
                      theme={mode === 'dark' ? 'vs-dark' : 'light'}
                      height='100%'
                      options={{
                        ...monacoOptions,
                        readOnly: true,
                      }}
                    />
                  ) : (
                    <Editor
                      loading={<Spin size='large' />}
                      language={language}
                      value={content?.schema || ''}
                      onMount={(editor) => setEditor(editor)}
                      onChange={(value) => {
                        graphActions.updateNode(id, (draft) => {
                          draft.content = { schema: value };
                          return draft;
                        });
                      }}
                      theme={mode === 'dark' ? 'vs-dark' : 'light'}
                      height='100%'
                      options={{
                        ...monacoOptions,
                        readOnly: disabled,
                      }}
                    />
                  ),
                )
                .exhaustive()}
            </div>
            <JsonToJsonSchemaDialog
              isOpen={jsonToJsonSchemaOpen}
              onDismiss={() => setJsonToJsonSchemaOpen(false)}
              onSuccess={({ schema, model }) => {
                localStorage.setItem(`${id}-model`, model);
                graphActions.updateNode(id, (draft) => {
                  draft.content = { schema };
                  return draft;
                });
                setJsonToJsonSchemaOpen(false);
              }}
              model={localStorage.getItem(`${id}-model`) || undefined}
            />
          </div>
        </div>
      </PanelGroup>
    </div>
  );
};
