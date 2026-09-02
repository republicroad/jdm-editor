import { Editor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import React, { useEffect, useRef } from 'react';

import { useT } from '../../../theming/i18n';
import { JsonToJsonSchemaDialog } from './json-to-json-schema-dialog';

export type RequestSchemaEditorProps = {
  schemaDraft: string;
  disabled: boolean;
  onSchemaChange: (value: string) => void;
  onSchemaCommit: () => void;
  jsonToJsonSchemaOpen: boolean;
  onConvertSuccess: (result: { schema: string; model: string }) => void;
  onDismissConvert: () => void;
  onEditorMount: (instance: editor.IStandaloneCodeEditor) => void;
  editorOptions: Record<string, unknown>;
  nodeId: string;
};

export const RequestSchemaEditor: React.FC<RequestSchemaEditorProps> = ({
  schemaDraft,
  disabled,
  onSchemaChange,
  onSchemaCommit,
  jsonToJsonSchemaOpen,
  onConvertSuccess,
  onDismissConvert,
  onEditorMount,
  editorOptions,
  nodeId,
}) => {
  useT();
  const blurDisposableRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    return () => {
      blurDisposableRef.current?.dispose();
      blurDisposableRef.current = null;
    };
  }, []);

  return (
    <div className='flex h-full min-h-0 flex-col gap-2'>
      <div className='min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-card'>
        <Editor
          height='100%'
          language='json'
          value={schemaDraft}
          onMount={(instance) => {
            blurDisposableRef.current?.dispose();
            blurDisposableRef.current = instance.onDidBlurEditorText(() => {
              onSchemaCommit();
            });
            onEditorMount(instance);
          }}
          onChange={(value) => onSchemaChange(value ?? '')}
          theme={(editorOptions as { theme?: string })?.theme ?? 'light'}
          options={{
            ...editorOptions,
            readOnly: disabled,
          }}
        />
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
