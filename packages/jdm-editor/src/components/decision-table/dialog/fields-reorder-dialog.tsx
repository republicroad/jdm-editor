import { Sortable, SortableItem, SortableItemHandle } from '#reui/sortable';
import React, { useEffect, useState } from 'react';

import { Form, Modal, Typography } from '../../primitives';
import type { TableSchemaItem } from '../context/dt-store.context';

export type FieldsReorderProps = {
  fields?: TableSchemaItem[];
  onSuccess?: (columns: TableSchemaItem[]) => void;
  onDismiss?: () => void;
  isOpen?: boolean;
  getContainer?: () => HTMLElement;
};

/**
 * WS2 填缝：字段重排对话框换 ReUI sortable——把手/overlay/键盘传感器标准化，
 * 重排结果仍以 onValueChange 全量列表回写（业务契约不变）。
 */
export const FieldsReorder: React.FC<FieldsReorderProps> = (props) => {
  const { isOpen, onDismiss, onSuccess, fields, getContainer } = props;

  const [columns, setColumns] = useState<TableSchemaItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setColumns([...(fields || [])]);
    }
  }, [isOpen, fields]);

  return (
    <Modal
      title='Reorder fields'
      open={isOpen}
      onCancel={onDismiss}
      width={360}
      destroyOnClose
      bodyStyle={{ paddingTop: 17 }}
      okText='Update'
      okButtonProps={{
        htmlType: 'submit',
        form: 'fields-reorder-dialog',
      }}
      getContainer={getContainer}
    >
      <Form id='fields-reorder-dialog' onFinish={() => onSuccess?.(columns)}>
        <Sortable
          value={columns}
          onValueChange={setColumns}
          getItemValue={(item: TableSchemaItem) => item.id}
          strategy='vertical'
          className='space-y-2'
        >
          {columns.map((column) => (
            <SortableItem key={column.id} value={column.id}>
              <div className='flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--background)] p-2 transition-colors'>
                <SortableItemHandle className='cursor-grab text-[var(--seal-color-text-tertiary)] active:cursor-grabbing'>
                  =
                </SortableItemHandle>
                <div className='flex min-w-0 flex-col'>
                  <Typography.Text>{column.name}</Typography.Text>
                  <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                    {column.field}
                  </Typography.Text>
                </div>
              </div>
            </SortableItem>
          ))}
        </Sortable>
      </Form>
    </Modal>
  );
};
