import { FormatPainterOutlined, ImportOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { Editor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import React, { useEffect, useRef } from 'react';

import { JsonToJsonSchemaDialog } from './json-to-json-schema-dialog';
import { useTranslation } from '../../../locales';

export type RequestSchemaEditorProps = {
  schemaDraft: string;
  disabled: boolean;
  onSchemaChange: (value: string) => void;
  onSchemaCommit: () => void;
  onFormat: () => void;
  jsonToJsonSchemaOpen: boolean;
  onOpenConvert: () => void;
  onConvertSuccess: (result: { schema: string; model: string }) => void;
  onDismissConvert: () => void;
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | undefined>;
  editorOptions: Record<string, unknown>;
  nodeId: string;
};

export const RequestSchemaEditor: React.FC<RequestSchemaEditorProps> = ({
  schemaDraft,
  disabled,
  onSchemaChange,
  onSchemaCommit,
  onFormat,
  jsonToJsonSchemaOpen,
  onOpenConvert,
  onConvertSuccess,
  onDismissConvert,
  editorRef,
  editorOptions,
  nodeId,
}) => {
  const { t } = useTranslation();
  const blurDisposableRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    return () => {
      blurDisposableRef.current?.dispose();
      blurDisposableRef.current = null;
    };
  }, []);

  return (
    <div className='grl-request-tab__body grl-request-tab__body--schema'>
      <div className='grl-request-tab__surface grl-request-tab__surface--schema'>
        <div className='grl-request-tab__schema-shell'>
          <div className='grl-request-tab__schema-editor'>
            <Editor
              height='100%'
              language='json'
              value={schemaDraft}
              onMount={(instance) => {
                editorRef.current = instance;
                blurDisposableRef.current?.dispose();
                blurDisposableRef.current = instance.onDidBlurEditorText(() => {
                  onSchemaCommit();
                });
              }}
              onChange={(value) => onSchemaChange(value ?? '')}
              theme={(editorOptions as any)?.theme ?? 'light'}
              options={{
                ...editorOptions,
                readOnly: disabled,
              }}
            />
          </div>
        </div>
      </div>
      <JsonToJsonSchemaDialog
        isOpen={jsonToJsonSchemaOpen}
        onDismiss={onDismissConvert}
        onSuccess={onConvertSuccess}
        model={localStorage.getItem(`${nodeId}-request-model`) || undefined}
      />
    </div>
  );
};
