import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input, Table } from 'antd';
import type { ColumnType } from 'antd/es/table';
import React from 'react';

export type EditableTableItem = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
  type?: 'text' | 'file';
};

export type EditableTableProps = {
  data: EditableTableItem[];
  disabled?: boolean;
  showDescription?: boolean;
  showType?: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: any) => void;
  addButtonText?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  descriptionPlaceholder?: string;
};

/**
 * 通用可编辑表格组件 - 用于Params/Headers/FormData
 */
export const EditableTable: React.FC<EditableTableProps> = ({
  data,
  disabled = false,
  showDescription = true,
  showType = false,
  onAdd,
  onRemove,
  onUpdate,
  addButtonText = 'Add Row',
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  descriptionPlaceholder = 'Description',
}) => {
  const columns: ColumnType<EditableTableItem>[] = [
    {
      title: '',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 50,
      render: (enabled: boolean, record) => (
        <Checkbox
          disabled={disabled}
          checked={enabled}
          onChange={(e) => onUpdate(record.id, 'enabled', e.target.checked)}
        />
      ),
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: showDescription ? '25%' : '35%',
      render: (key: string, record) => (
        <Input
          disabled={disabled}
          placeholder={keyPlaceholder}
          value={key}
          onChange={(e) => onUpdate(record.id, 'key', e.target.value)}
          bordered={false}
          style={{ padding: '4px 8px' }}
        />
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: showDescription ? '30%' : '50%',
      render: (value: string, record) => (
        <Input
          disabled={disabled}
          placeholder={valuePlaceholder}
          value={value}
          onChange={(e) => onUpdate(record.id, 'value', e.target.value)}
          bordered={false}
          style={{ padding: '4px 8px' }}
        />
      ),
    },
  ];

  // 添加Description列
  if (showDescription) {
    columns.push({
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: '30%',
      render: (description: string | undefined, record) => (
        <Input
          disabled={disabled}
          placeholder={descriptionPlaceholder}
          value={description || ''}
          onChange={(e) => onUpdate(record.id, 'description', e.target.value)}
          bordered={false}
          style={{ padding: '4px 8px' }}
        />
      ),
    });
  }

  // 添加Type列（用于FormData）
  if (showType) {
    columns.push({
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: 'text' | 'file' | undefined, record) => (
        <Button
          disabled={disabled}
          type="text"
          size="small"
          onClick={() => onUpdate(record.id, 'type', type === 'file' ? 'text' : 'file')}
          style={{ padding: '4px 8px' }}
        >
          {type === 'file' ? '📎 File' : '📝 Text'}
        </Button>
      ),
    });
  }

  // 添加操作列
  columns.push({
    title: '',
    key: 'action',
    width: 60,
    render: (_, record) => (
      <Button
        disabled={disabled}
        type="text"
        danger
        icon={<DeleteOutlined />}
        onClick={() => onRemove(record.id)}
        size="small"
      />
    ),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Table
        dataSource={data}
        columns={columns}
        pagination={false}
        size="small"
        rowKey="id"
        scroll={{ y: 300 }}
        locale={{
          emptyText: (
            <div style={{ padding: '20px 0', color: '#999' }}>
              No data. Click "Add Row" to add a new entry.
            </div>
          ),
        }}
        style={{
          border: '1px solid #f0f0f0',
          borderRadius: 4,
        }}
      />
      <Button
        disabled={disabled}
        type="dashed"
        icon={<PlusOutlined />}
        onClick={onAdd}
        block
      >
        {addButtonText}
      </Button>
    </div>
  );
};