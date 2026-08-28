import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import React, { useEffect, useRef, useState } from 'react';

import { DragOverlayCard, OverlayChip, OverlayIndexChip } from '../../helpers/dnd-overlay';
import { DictionaryProvider } from '../../theme';
import { SafeBoundary } from '../safe-boundary';
import { DecisionTableDialogProvider } from './context/dt-dialog.context';
import type { DecisionTableContextProps } from './context/dt-store.context';
import {
  DecisionTableProvider,
  useDecisionTableActions,
  useDecisionTableRaw,
  useDecisionTableState,
} from './context/dt-store.context';
import { DecisionTableDialogs } from './dialog/dt-dialogs';
import { DecisionTableCommandBar } from './dt-command-bar';
import type { DecisionTableEmptyType } from './dt-empty';
import { DecisionTableEmpty } from './dt-empty';
import type { TableScrollApi } from './table/table';
import { Table } from './table/table';

export type { TableScrollApi } from './table/table';

export type DecisionTableProps = {
  id?: string;
  tableHeight: string | number;
  mountDialogsOnBody?: boolean;
  scrollContainerRef?: React.MutableRefObject<HTMLDivElement | null>;
  scrollApiRef?: React.MutableRefObject<TableScrollApi | null>;
} & DecisionTableContextProps &
  DecisionTableEmptyType;

export const DecisionTable: React.FC<DecisionTableProps> = ({
  id,
  tableHeight,
  mountDialogsOnBody = false,
  scrollContainerRef,
  scrollApiRef,
  ...props
}) => {
  const [_, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getContainer = () => ref.current as HTMLElement;

  return (
    <SafeBoundary>
      <div
        ref={ref}
        className='text-sm h-full flex min-h-px flex-col pr-1 [--table-color:var(--background)]'
        style={{ background: 'var(--card)' }}
      >
        {ref.current && (
          <DecisionTableProvider>
            <DecisionTableDnd>
              <DecisionTableDialogProvider getContainer={mountDialogsOnBody ? undefined : getContainer}>
                <DecisionTableCommandBar />
                <DictionaryBridge>
                  <Table
                    id={id}
                    maxHeight={tableHeight}
                    scrollContainerRef={scrollContainerRef}
                    scrollApiRef={scrollApiRef}
                  />
                </DictionaryBridge>
                <DecisionTableDialogs />
                <DecisionTableEmpty {...props} />
              </DecisionTableDialogProvider>
            </DecisionTableDnd>
          </DecisionTableProvider>
        )}
      </div>
    </SafeBoundary>
  );
};

const DecisionTableDnd: React.FC<React.PropsWithChildren> = ({ children }) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const actions = useDecisionTableActions();
  const { stateStore } = useDecisionTableRaw();
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  // Read the rule imperatively at render time instead of subscribing to the
  // whole rules list - a deep-equal subscription here would run on every
  // cell commit for zero benefit (overlay content is fixed during a drag).
  const activeRule = activeRowIndex == null ? undefined : stateStore.getState().decisionTable.rules[activeRowIndex];

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => {
        const index = active.data.current?.index;
        if (typeof index === 'number') {
          setActiveRowIndex(index);
        }
      }}
      onDragEnd={({ active, over }) => {
        setActiveRowIndex(null);
        if (!over) {
          return;
        }

        const from = active.data.current?.index;
        const to = over.data.current?.index;
        if (from === undefined || to === undefined || from === to) {
          return;
        }

        actions.swapRows(from, to);
      }}
      onDragCancel={() => setActiveRowIndex(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeRule ? (
          <DragOverlayCard>
            <OverlayIndexChip index={activeRowIndex ?? 0} />
            {[
              ...(stateStore.getState().decisionTable.inputs || []),
              ...(stateStore.getState().decisionTable.outputs || []),
            ].map((schemaItem) => (
              <OverlayChip key={schemaItem.id} width={110}>
                {activeRule[schemaItem.id]}
              </OverlayChip>
            ))}
            {activeRule._description ? (
              <OverlayChip width={160}>
                <span style={{ color: 'var(--grl-color-text-tertiary)' }}>{activeRule._description}</span>
              </OverlayChip>
            ) : null}
          </DragOverlayCard>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

const DictionaryBridge: React.FC<React.PropsWithChildren> = ({ children }) => {
  const dictionaries = useDecisionTableState((s) => s.dictionaries) ?? {};
  return <DictionaryProvider value={dictionaries}>{children}</DictionaryProvider>;
};
