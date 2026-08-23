import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import React, { useEffect, useRef, useState } from 'react';

import { DictionaryProvider } from '../../theme';
import { DecisionTableDialogProvider } from './context/dt-dialog.context';
import type { DecisionTableContextProps } from './context/dt-store.context';
import {
  DecisionTableProvider,
  useDecisionTableActions,
  useDecisionTableState,
} from './context/dt-store.context';
import { DecisionTableDialogs } from './dialog/dt-dialogs';
import { DecisionTableCommandBar } from './dt-command-bar';
import type { DecisionTableEmptyType } from './dt-empty';
import { DecisionTableEmpty } from './dt-empty';
import './dt.scss';
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
    <div ref={ref} className={'grl-dt'} style={{ background: 'var(--grl-color-bg-elevated)' }}>
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
  );
};

const DecisionTableDnd: React.FC<React.PropsWithChildren> = ({ children }) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const actions = useDecisionTableActions();

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={({ active, over }) => {
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
    >
      {children}
    </DndContext>
  );
};

const DictionaryBridge: React.FC<React.PropsWithChildren> = ({ children }) => {
  const dictionaries = useDecisionTableState((s) => s.dictionaries) ?? {};
  return <DictionaryProvider value={dictionaries}>{children}</DictionaryProvider>;
};
