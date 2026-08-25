import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import React, { useState } from 'react';

import { DragOverlayCard, OverlayChip } from '../../../../helpers/dnd-overlay';
import type { ImportColumn } from './types';

export const ExcelDnd: React.FC<
  React.PropsWithChildren<{
    onMove: (draggedId: string, overId: string) => void;
    getColumnById: (id: string) => ImportColumn | undefined;
  }>
> = ({ children, onMove, getColumnById }) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeColumn = activeId ? getColumnById(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(String(active.id).replace(/^xl-/, ''))}
      onDragOver={({ active, over }) => {
        if (!over) {
          return;
        }

        const draggedId = String(active.id).replace(/^xl-/, '');
        const overId = String(over.id).replace(/^xl-/, '');
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
            <OverlayChip width={160}>{activeColumn.name}</OverlayChip>
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
