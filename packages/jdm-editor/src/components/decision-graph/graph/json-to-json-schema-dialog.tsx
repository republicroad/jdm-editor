import { Editor } from '@monaco-editor/react';

import '../../../helpers/monaco';
import { Modal, Spin, Typography, message, theme } from 'antd';
import json5 from 'json5';
import React, { useEffect, useState } from 'react';
import toJsonSchema from 'to-json-schema';

import { useTranslation } from '../../../locales';
import { copyToClipboard } from '../../../helpers/utility';

const invisibleFormatCharacters = /[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
const looseDateTimePattern =
  /^\s*(?:(?:\d{4}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01]))|(?:\d{4}年(?:0?[1-9]|1[0-2])月(?:0?[1-9]|[12]\d|3[01])日?))[T\s]+(?:[01]?\d|2[0-3]):[0-5]?\d(?::[0-5]?\d(?:\.\d{1,9})?)?(?:\s*(?:Z|(?:UTC|GMT)?\s*[+-](?:[01]?\d|2[0-3])(?::?[0-5]\d)?))?\s*$/i;
const utcMillisecPattern = /^\d{13}$/;
const cssHexColorPattern = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const cssColorFunctionPattern = /^(?:rgb|rgba|hsl|hsla)\(\s*[^)]*\)$/i;
const cssDeclarationPattern =
  /^\s*(?:(?:--[a-z_][\w-]*|-?[a-z_][\w-]*(?:-[a-z0-9_]+)*)\s*:\s*[^;]+;?\s*)+$/i;
const cssNamedColors = new Set([
  'aqua',
  'black',
  'blue',
  'fuchsia',
  'gray',
  'green',
  'lime',
  'maroon',
  'navy',
  'olive',
  'orange',
  'purple',
  'red',
  'silver',
  'teal',
  'white',
  'yellow',
  'transparent',
  'currentcolor',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeJsonModelKey = (key: string) => key.normalize('NFKC').replace(invisibleFormatCharacters, '').trim();

const normalizeJsonModel = (model: unknown): unknown => {
  if (Array.isArray(model)) {
    return model.map(normalizeJsonModel);
  }

  if (!isRecord(model)) {
    return model;
  }

  return Object.entries(model).reduce<Record<string, unknown>>((normalizedModel, [key, value]) => {
    normalizedModel[normalizeJsonModelKey(key)] = normalizeJsonModel(value);
    return normalizedModel;
  }, {});
};

const getJsonSchemaType = (schema: Record<string, unknown>) => {
  const schemaType = schema.type;
  return Array.isArray(schemaType) ? schemaType.find((type) => type !== 'null') ?? schemaType[0] : schemaType;
};

const isReasonableUtcMillisec = (value: string) => {
  if (!utcMillisecPattern.test(value)) {
    return false;
  }

  const timestamp = Number(value);
  const minTimestamp = Date.UTC(2000, 0, 1);
  const maxTimestamp = Date.UTC(2200, 0, 1);

  return Number.isFinite(timestamp) && timestamp >= minTimestamp && timestamp <= maxTimestamp;
};

const isStrictColorValue = (value: string) =>
  cssHexColorPattern.test(value) || cssColorFunctionPattern.test(value) || cssNamedColors.has(value.toLowerCase());

const normalizeStringSchemaFormat = (schema: Record<string, unknown>, value: unknown) => {
  if (typeof value !== 'string') {
    return;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return;
  }

  if (looseDateTimePattern.test(trimmedValue)) {
    schema.format = 'date-time';
    return;
  }

  switch (schema.format) {
    case 'utc-millisec':
      if (!isReasonableUtcMillisec(trimmedValue)) {
        delete schema.format;
      }
      return;
    case 'color':
      if (!isStrictColorValue(trimmedValue)) {
        delete schema.format;
      }
      return;
    case 'style':
      if (!cssDeclarationPattern.test(trimmedValue)) {
        delete schema.format;
      }
      return;
    default:
      return;
  }
};

const normalizeConvertedJsonSchema = (schema: unknown, model: unknown): unknown => {
  if (!isRecord(schema)) {
    return schema;
  }

  const normalizedSchema: Record<string, unknown> = { ...schema };
  const schemaType = getJsonSchemaType(normalizedSchema);

  if (schemaType === 'string') {
    normalizeStringSchemaFormat(normalizedSchema, model);
  }

  if (schemaType === 'object' && isRecord(normalizedSchema.properties)) {
    const modelRecord = isRecord(model) ? model : {};
    normalizedSchema.properties = Object.entries(normalizedSchema.properties).reduce<Record<string, unknown>>(
      (normalizedProperties, [key, propertySchema]) => {
        normalizedProperties[key] = normalizeConvertedJsonSchema(propertySchema, modelRecord[key]);
        return normalizedProperties;
      },
      {},
    );
  }

  if (schemaType === 'array' && normalizedSchema.items) {
    const modelItems = Array.isArray(model) ? model : [];
    if (Array.isArray(normalizedSchema.items)) {
      normalizedSchema.items = normalizedSchema.items.map((itemSchema, index) =>
        normalizeConvertedJsonSchema(itemSchema, modelItems[index]),
      );
    } else {
      const sampleItem = modelItems.find((item) => item !== undefined && item !== null);
      normalizedSchema.items = normalizeConvertedJsonSchema(normalizedSchema.items, sampleItem);
    }
  }

  return normalizedSchema;
};

export type JsonToJsonSchemaDialogProps = {
  id?: string;
  onSuccess?: (payload: { schema: string; model: string }) => void;
  onDismiss?: () => void;
  isOpen?: boolean;
  model?: string;
};

export const JsonToJsonSchemaDialog: React.FC<JsonToJsonSchemaDialogProps> = (props) => {
  const { isOpen, onDismiss, onSuccess, model } = props;

  const { t } = useTranslation();
  const { token } = theme.useToken();

  const [value, setValue] = useState<string>('');

  useEffect(() => {
    if (isOpen && model) {
      setValue(model);
    }
  }, [isOpen]);

  return (
    <Modal
      title={t('convertToJsonSchema')}
      open={isOpen}
      destroyOnClose
      onCancel={onDismiss}
      width={540}
      okText={t('convert')}
      onOk={() => {
        try {
          const normalizedModel = normalizeJsonModel(json5.parse(value));
          const convertedSchema = normalizeConvertedJsonSchema(toJsonSchema(normalizedModel), normalizedModel);
          onSuccess?.({
            schema: JSON.stringify(convertedSchema, null, 2),
            model: JSON.stringify(normalizedModel, null, 2),
          });
        } catch (e: any) {
          message.error(e?.message);
        }
      }}
    >
      <Typography.Text>{t('typeOrPasteJson')}</Typography.Text>
      <Editor
        loading={<Spin size='large' />}
        language='javascript'
        theme={token.mode === 'dark' ? 'vs-dark' : 'light'}
        height='400px'
        onChange={(val) => setValue(val || '')}
        value={value || ''}
        onMount={(editor, monaco) => {
          monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSyntaxValidation: true,
          });

          monaco.languages.typescript.javascriptDefaults.setModeConfiguration({
            codeActions: false,
            inlayHints: false,
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
              const formatted = JSON.stringify(json5.parse(editor.getValue()), null, 2);
              editor.setValue(formatted);
            },
          });
        }}
        options={{
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
    </Modal>
  );
};
