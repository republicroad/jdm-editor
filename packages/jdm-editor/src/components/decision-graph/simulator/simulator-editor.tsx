import { Editor } from '@monaco-editor/react';
import { Spin, message, theme } from 'antd';
import json5 from 'json5';
import React, { useEffect, useRef } from 'react';

import '../../../helpers/monaco';
import { copyToClipboard } from '../../../helpers/utility';
import { useTranslation } from '../../../locales';

type SimulatorEditorProps = {
  value?: string;
  onChange?: (value: string | undefined) => void;
  onBlur?: () => void;
  readOnly?: boolean;
};

export const SimulatorEditor: React.FC<SimulatorEditorProps> = ({ value, onChange, onBlur, readOnly }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const onBlurRef = useRef(onBlur);

  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  return (
    <Editor
      loading={<Spin size='large' />}
      language='javascript'
      value={value}
      onChange={onChange}
      theme={token.mode === 'dark' ? 'vs-dark' : 'light'}
      height='100%'
      onMount={(editor, monaco) => {
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSyntaxValidation: true,
        });

        monaco.languages.typescript.javascriptDefaults.setModeConfiguration({
          codeActions: false,
          inlayHints: false,
        });

        editor.onDidBlurEditorText(() => {
          onBlurRef.current?.();
        });

        editor.addAction({
          id: 'copy-json',
          label: t('copyJson'),
          contextMenuGroupId: 'utils',
          run: async (editor) => {
            try {
              await copyToClipboard(JSON.stringify(json5.parse(editor.getValue())));
              message.success(t('copiedToClipboard'));
            } catch {
              message.error(t('copyFailed'));
            }
          },
        });

        editor.addAction({
          id: 'format',
          label: t('format'),
          contextMenuGroupId: 'utils',
          precondition: '!editorReadonly',
          run: (editor) => {
            try {
              const formatted = JSON.stringify(json5.parse(editor.getValue()), null, 2);
              editor.setValue(formatted);
              message.success(t('formatSuccess'));
            } catch (error) {
            message.error(t('formatFailed'));
            }
            
          },
        });
      }}
      options={{
        readOnly: readOnly,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 12,
        fontFamily: 'var(--mono-font-family)',
        tabSize: 2,
        lineDecorationsWidth: 2,
        find: {
          addExtraSpaceOnTop: false,
          seedSearchStringFromSelection: 'never',
        },
        scrollbar: {
          verticalSliderSize: 4,
          verticalScrollbarSize: 4,
          horizontalScrollbarSize: 4,
          horizontalSliderSize: 4,
        },
        lineNumbersMinChars: 3,
      }}
    />
  );
};
