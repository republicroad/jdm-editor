import React, { useEffect, useRef, useState } from 'react';

import { DictionaryProvider } from '../../theme';
import { SafeBoundary } from '../safe-boundary';
import { DecisionTableDialogProvider } from './context/dt-dialog.context';
import type { DecisionTableContextProps } from './context/dt-store.context';
import { DecisionTableProvider, useDecisionTableState } from './context/dt-store.context';
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
          </DecisionTableProvider>
        )}
      </div>
    </SafeBoundary>
  );
};

const DictionaryBridge: React.FC<React.PropsWithChildren> = ({ children }) => {
  const dictionaries = useDecisionTableState((s) => s.dictionaries) ?? {};
  return <DictionaryProvider value={dictionaries}>{children}</DictionaryProvider>;
};
