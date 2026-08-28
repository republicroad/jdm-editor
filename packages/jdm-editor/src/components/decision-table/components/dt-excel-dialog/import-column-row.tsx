import { DeleteOutlined, EditOutlined, HolderOutlined, LeftOutlined } from '@/icons';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import React from 'react';

import type { ColumnFieldType, OutputFieldType } from '../../../../helpers/schema';
import { Button, Checkbox, Popconfirm, Select, Switch, Tooltip, Typography } from '../../../primitives';
import { InputFieldEdit } from '../input-field-edit';
import { OutputFieldEdit } from '../output-field-edit';
import type { ImportColumn } from './types';

export const ImportColumnRow: React.FC<{
  col: ImportColumn;
  section: 'input' | 'output';
  excelHeaders: { id: string; name?: string; value?: string }[];
  disabled: boolean;
  wrapChecked: boolean;
  onToggle: (enabled: boolean) => void;
  onExcelHeaderChange: (excelHeaderId: string | undefined) => void;
  onWrapChange: (checked: boolean) => void;
  onFieldChange: (field: string, fieldType?: ColumnFieldType, outputFieldType?: OutputFieldType) => void;
  onRemove: () => void;
}> = ({
  col,
  section,
  excelHeaders,
  disabled,
  wrapChecked,
  onToggle,
  onExcelHeaderChange,
  onWrapChange,
  onFieldChange,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    setActivatorNodeRef,
    isDragging,
  } = useDraggable({
    id: `xl-${col.id}`,
    data: { id: col.id },
    disabled,
  });

  const { setNodeRef: setDropNodeRef } = useDroppable({
    id: `xl-${col.id}`,
  });

  const excelOptions = excelHeaders.map((h) => ({
    label: h.name || h.value || h.id,
    value: h.id,
  }));

  const editTrigger = (
    <Tooltip title='Edit column'>
      <Button type='text' size='small' icon={<EditOutlined />} style={{ padding: 0 }} />
    </Tooltip>
  );

  return (
    <div
      ref={(el) => {
        setDragNodeRef(el);
        setDropNodeRef(el);
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 36px 1fr 12px 1fr 28px 28px 28px',
        gap: '8px',
        alignItems: 'center',
        padding: '6px 0',
        opacity: isDragging ? 0.3 : disabled ? 0.4 : 1,
      }}
    >
      <div
        {...listeners}
        {...attributes}
        ref={setActivatorNodeRef}
        style={{
          cursor: disabled ? 'default' : 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <HolderOutlined style={{ color: 'var(--grl-color-text-tertiary)' }} />
      </div>

      <Switch size='small' checked={!disabled} onChange={onToggle} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '4px 10px',
          backgroundColor: 'var(--background)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          minHeight: 36,
          justifyContent: 'center',
        }}
      >
        <Typography.Text style={{ fontSize: 13, lineHeight: '18px' }}>{col.name}</Typography.Text>
        {col.field && (
          <Typography.Text type='secondary' style={{ fontSize: 11, lineHeight: '14px' }}>
            {col.field}
          </Typography.Text>
        )}
      </div>

      <LeftOutlined style={{ fontSize: 12, color: 'var(--primary)' }} />

      <Select
        allowClear
        style={{ width: '100%' }}
        placeholder='Select Excel column'
        value={col.excelHeaderId}
        disabled={disabled}
        onChange={(val) => onExcelHeaderChange(val ?? undefined)}
        options={excelOptions}
      />

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Tooltip title='Wrap values in quotes'>
          <Checkbox disabled={disabled} checked={wrapChecked} onChange={(e) => onWrapChange(e.target.checked)} />
        </Tooltip>
      </div>

      {section === 'input' ? (
        <InputFieldEdit
          mode='edit'
          value={col.field}
          fieldType={col.fieldType}
          onChange={(field, fieldType) => onFieldChange(field, fieldType)}
          onRemove={onRemove}
          trigger={editTrigger}
        />
      ) : (
        <OutputFieldEdit
          mode='edit'
          value={col.field}
          fieldType={col.outputFieldType}
          onChange={(field, outputFieldType) => onFieldChange(field, undefined, outputFieldType)}
          onRemove={onRemove}
          trigger={editTrigger}
        />
      )}

      <Popconfirm title='Remove this column?' okText='Remove' onConfirm={onRemove}>
        <Tooltip title='Remove column'>
          <Button type='text' size='small' danger icon={<DeleteOutlined />} style={{ padding: 0 }} />
        </Tooltip>
      </Popconfirm>
    </div>
  );
};
