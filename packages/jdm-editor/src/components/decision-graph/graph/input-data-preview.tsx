import { Editor } from '@monaco-editor/react';
import { ApartmentOutlined, EyeOutlined } from '@ant-design/icons';
import { Segmented, Typography, theme } from 'antd';
import type { editor } from 'monaco-editor';
import React from 'react';

import '../../../helpers/monaco';
import { parseFields } from '../../../helpers/field-parser';
import type { FieldInfo } from '../../../helpers/field-parser';
import { FieldTreeView } from './field-tree-view';

export type { FieldInfo };

const { Text } = Typography;

type ViewMode = 'tree' | 'json';

const monacoOptions: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  contextmenu: false,
  fontSize: 13,
  fontFamily: 'var(--mono-font-family)',
  tabSize: 2,
  minimap: { enabled: false },
  overviewRulerBorder: false,
  readOnly: true,
  scrollbar: {
    verticalSliderSize: 4,
    verticalScrollbarSize: 4,
    horizontalScrollbarSize: 4,
    horizontalSliderSize: 4,
  },
  lineNumbers: 'off',
  folding: false,
  glyphMargin: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
};

export type DataPreviewProps = {
  data: unknown;
  title: string;
  emptyText?: string;
  onFieldClick?: (field: FieldInfo) => void;
  onFieldDragStart?: (fieldPath: string, e: React.DragEvent) => void;
};

export const DataPreview: React.FC<DataPreviewProps> = ({
  data,
  title,
  emptyText = '暂无数据',
  onFieldClick,
  onFieldDragStart,
}) => {
  const { token } = theme.useToken();
  const [viewMode, setViewMode] = React.useState<ViewMode>('tree');

  const jsonString = React.useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return '{}';
    }
  }, [data]);

  // 解析字段
  const fields = React.useMemo(() => {
    if (!data) return [];
    return parseFields(data, { maxDepth: 5, includeValues: true });
  }, [data]);

  // 字段点击处理
  const handleFieldClick = (field: FieldInfo) => {
    onFieldClick?.(field);
  };

  // 字段拖拽处理
  const handleFieldDragStart = (field: FieldInfo, e: React.DragEvent) => {
    const dragData = {
      path: field.path,
      nodePath: field.nodePath,
      type: field.type,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
    onFieldDragStart?.(field.path, e);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: token.colorBgContainer }}>
      {/* 标题栏 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${token.colorBorder}`,
          backgroundColor: token.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          {title}
        </Text>

        {data != null && (
          <Segmented
            size="small"
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            options={[
              { label: '树形', value: 'tree', icon: <ApartmentOutlined /> },
              { label: 'JSON', value: 'json', icon: <EyeOutlined /> },
            ]}
          />
        )}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {data ? (
          viewMode === 'tree' ? (
            <FieldTreeView
              fields={fields}
              onFieldClick={handleFieldClick}
              onFieldDragStart={handleFieldDragStart}
            />
          ) : (
            <Editor
              language="json"
              value={jsonString}
              options={monacoOptions}
              theme={token.colorBgContainer === '#ffffff' ? 'light' : 'vs-dark'}
            />
          )
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: token.colorTextSecondary,
            }}
          >
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
};

// 保持向后兼容的别名
export const InputDataPreview: React.FC<{
  data: unknown;
  onFieldClick?: (field: FieldInfo) => void;
  onFieldDragStart?: (fieldPath: string, e: React.DragEvent) => void;
}> = ({ data, onFieldClick, onFieldDragStart }) => {
  return (
    <DataPreview
      data={data}
      title="输入数据"
      emptyText="运行 Simulator 后显示上游节点输出"
      onFieldClick={onFieldClick}
      onFieldDragStart={onFieldDragStart}
    />
  );
};

export const OutputDataPreview: React.FC<{
  data: unknown;
  onFieldClick?: (field: FieldInfo) => void;
  onFieldDragStart?: (fieldPath: string, e: React.DragEvent) => void;
}> = ({ data, onFieldClick, onFieldDragStart }) => {
  return (
    <DataPreview
      data={data}
      title="输出数据"
      emptyText="运行后显示当前节点输出"
      onFieldClick={onFieldClick}
      onFieldDragStart={onFieldDragStart}
    />
  );
};
