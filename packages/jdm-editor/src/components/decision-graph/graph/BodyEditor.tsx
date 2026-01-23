import { Button, Select, Space, Typography } from 'antd';
import Editor from '@monaco-editor/react';
import React, { useState } from 'react';
import { EditableTable, type EditableTableItem } from './EditableTable';

export type BodyConfig = {
  type: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'xml';
  content: string;
  formData?: Array<{
    id: string;
    key: string;
    value: string;
    enabled: boolean;
    type: 'text' | 'file';
    description?: string;
  }>;
};

export type BodyEditorProps = {
  body?: BodyConfig;
  disabled?: boolean;
  onChange: (body: BodyConfig) => void;
};

/**
 * Body编辑器组件 - 支持多种类型的Body编辑
 */
export const BodyEditor: React.FC<BodyEditorProps> = ({ body, disabled = false, onChange }) => {
  const [formatError, setFormatError] = useState<string | null>(null);

  const bodyType = body?.type || 'none';
  const bodyContent = body?.content || '';
  const formData = body?.formData || [];

  // 更新Body类型
  const handleTypeChange = (type: BodyConfig['type']) => {
    onChange({
      type,
      content: type === 'json' ? '{}' : '',
      formData: type === 'form-data' || type === 'x-www-form-urlencoded' ? [] : undefined,
    });
    setFormatError(null);
  };

  // 更新Body内容
  const handleContentChange = (content: string) => {
    onChange({
      ...body,
      type: bodyType,
      content,
    });
  };

  // 格式化JSON
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(bodyContent);
      const formatted = JSON.stringify(parsed, null, 2);
      handleContentChange(formatted);
      setFormatError(null);
    } catch (error) {
      setFormatError('Invalid JSON format');
    }
  };

  // 压缩JSON
  const handleMinifyJson = () => {
    try {
      const parsed = JSON.parse(bodyContent);
      const minified = JSON.stringify(parsed);
      handleContentChange(minified);
      setFormatError(null);
    } catch (error) {
      setFormatError('Invalid JSON format');
    }
  };

  // FormData操作
  const handleAddFormDataItem = () => {
    const newFormData = [
      ...formData,
      { id: crypto.randomUUID(), key: '', value: '', enabled: true, type: 'text' as const, description: '' },
    ];
    onChange({
      ...body,
      type: bodyType,
      content: bodyContent,
      formData: newFormData,
    });
  };

  const handleRemoveFormDataItem = (id: string) => {
    const newFormData = formData.filter((item) => item.id !== id);
    onChange({
      ...body,
      type: bodyType,
      content: bodyContent,
      formData: newFormData,
    });
  };

  const handleUpdateFormDataItem = (id: string, field: string, value: any) => {
    const newFormData = formData.map((item) => (item.id === id ? { ...item, [field]: value } : item));
    onChange({
      ...body,
      type: bodyType,
      content: bodyContent,
      formData: newFormData,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Body类型选择 */}
      <Space>
        <Typography.Text strong>Body Type:</Typography.Text>
        <Select
          disabled={disabled}
          value={bodyType}
          onChange={handleTypeChange}
          style={{ width: 250 }}
          options={[
            { value: 'none', label: 'None' },
            { value: 'json', label: 'JSON' },
            { value: 'raw', label: 'Raw Text' },
            { value: 'xml', label: 'XML' },
            { value: 'form-data', label: 'Form Data' },
            { value: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
          ]}
        />
      </Space>

      {/* JSON编辑器 */}
      {bodyType === 'json' && (
        <div>
          <Space style={{ marginBottom: 8 }}>
            <Button disabled={disabled} size="small" onClick={handleFormatJson}>
              Format
            </Button>
            <Button disabled={disabled} size="small" onClick={handleMinifyJson}>
              Minify
            </Button>
            {formatError && (
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                {formatError}
              </Typography.Text>
            )}
          </Space>
          <Editor
            height="300px"
            defaultLanguage="json"
            value={bodyContent}
            onChange={(value) => handleContentChange(value || '')}
            options={{
              readOnly: disabled,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
            theme="vs-light"
          />
        </div>
      )}

      {/* Raw Text编辑器 */}
      {bodyType === 'raw' && (
        <Editor
          height="300px"
          defaultLanguage="plaintext"
          value={bodyContent}
          onChange={(value) => handleContentChange(value || '')}
          options={{
            readOnly: disabled,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
          }}
          theme="vs-light"
        />
      )}

      {/* XML编辑器 */}
      {bodyType === 'xml' && (
        <Editor
          height="300px"
          defaultLanguage="xml"
          value={bodyContent}
          onChange={(value) => handleContentChange(value || '')}
          options={{
            readOnly: disabled,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
          theme="vs-light"
        />
      )}

      {/* Form Data表格 */}
      {(bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') && (
        <EditableTable
          data={formData as EditableTableItem[]}
          disabled={disabled}
          showDescription={true}
          showType={bodyType === 'form-data'}
          onAdd={handleAddFormDataItem}
          onRemove={handleRemoveFormDataItem}
          onUpdate={handleUpdateFormDataItem}
          addButtonText={`Add ${bodyType === 'form-data' ? 'Form Data' : 'URL Encoded'} Item`}
          keyPlaceholder="Key"
          valuePlaceholder="Value"
          descriptionPlaceholder="Description (optional)"
        />
      )}

      {/* None状态 */}
      {bodyType === 'none' && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>
          <Typography.Text type="secondary">No body content</Typography.Text>
        </div>
      )}
    </div>
  );
};