import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { Card, Form, Modal, Typography } from '../../primitives';
import React, { useEffect, useRef, useState } from 'react';

import { DragOverlayCard, OverlayChip } from '../../../helpers/dnd-overlay';
import { Stack } from '../../stack';
import type { TableSchemaItem } from '../context/dt-store.context';

export type FieldsReorderProps = {
  fields?: TableSchemaItem[];
  onSuccess?: (columns: TableSchemaItem[]) => void;
  onDismiss?: () => void;
  isOpen?: boolean;
  getContainer?: () => HTMLElement;
};

const FieldCard: React.FC<{
  col: TableSchemaItem;
  index: number;
}> = ({ col, index }) => {
  const { attributes, listeners, setNodeRef: setDragNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `field-${col.id}`,
    data: { index },
  });

  const { setNodeRef: setDropNodeRef } = useDroppable({
    id: `field-${col.id}`,
    data: { index },
  });

  return (
    <Card
      ref={(el) => {
        setDropNodeRef(el);
        setDragNodeRef(el);
      }}
      style={{ opacity: isDragging ? 0 : 1 }}
      bodyStyle={{ padding: '0.5rem' }}
    >
      <div className='hover:cursor-grab'>
        <Stack horizontal verticalAlign='center'>
          <div
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
          >=</div>
          <Stack grow gap={0}>
            <Typography.Text>{col.name}</Typography.Text>
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              {col.field}
            </Typography.Text>
          </Stack>
        </Stack>
      </div>
    </Card>
  );
};

const FieldsDnd: React.FC<
  React.PropsWithChildren<{
    onMove: (draggedId: string, overId: string) => void;
    getColumnById: (id: string) => TableSchemaItem | undefined;
  }>
> = ({ children, onMove, getColumnById }) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeColumn = activeId ? getColumnById(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(String(active.id).replace(/^field-/, ''))}
      onDragOver={({ active, over }) => {
        if (!over) {
          return;
        }

        const draggedId = String(active.id).replace(/^field-/, '');
        const overId = String(over.id).replace(/^field-/, '');
        if (draggedId !== overId) {
          onMove(draggedId, overId);
        }
      }}
      onDragEnd={() => setActiveId(null)}
      onDragCancel={() => setActiveId(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeColumn ? (
          <DragOverlayCard>
            <OverlayChip width={180}>{activeColumn.name}</OverlayChip>
            {activeColumn.field ? (
              <OverlayChip width={140}>
                <span style={{ color: 'var(--grl-color-text-tertiary)' }}>{activeColumn.field}</span>
              </OverlayChip>
            ) : null}
          </DragOverlayCard>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export const FieldsReorder: React.FC<FieldsReorderProps> = (props) => {
  const { isOpen, onDismiss, onSuccess, fields, getContainer } = props;

  const [columns, setColumns] = useState<TableSchemaItem[]>([]);
  const columnsRef = useRef<TableSchemaItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setColumns([...(fields || [])]);
    }
  }, [isOpen, fields]);

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const moveCardByIds = (draggedId?: string, overId?: string) => {
    if (!draggedId || !overId || draggedId === overId) {
      return;
    }

    const list = columnsRef.current;
    const from = list.findIndex((c) => c.id === draggedId);
    const to = list.findIndex((c) => c.id === overId);
    if (from === -1 || to === -1) {
      return;
    }

    const tmpList = [...list];
    const element = tmpList.splice(from, 1)[0];
    tmpList.splice(to, 0, element);
    setColumns(tmpList);
  };

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
        <FieldsDnd onMove={moveCardByIds} getColumnById={(id) => columnsRef.current.find((c) => c.id === id)}>
          <Stack gap={8} horizontalAlign='stretch'>
            {columns.map((column, index) => (
              <FieldCard key={column.id} col={column} index={index} />
            ))}
          </Stack>
        </FieldsDnd>
      </Form>
    </Modal>
  );
};
