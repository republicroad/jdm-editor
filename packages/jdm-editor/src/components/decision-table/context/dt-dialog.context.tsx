import React, { useState } from 'react';

import type { ColumnType, TableSchemaItem } from './dt-store.context';

export type TableDialogType = 'reorder';
export type TableDialogState = {
  type: TableDialogType;
  item: TableSchemaItem | null;
  columnType: ColumnType;
};

export type TableDialogContextState = {
  setDialog: React.Dispatch<React.SetStateAction<TableDialogState | undefined>>;
  dialog: TableDialogState | undefined;
  isDialogActive: (type: TableDialogType) => boolean;
  getContainer?: () => HTMLElement;
};

// Empty-object default is safe: consumers only render inside
// DecisionTableDialogProvider, which supplies the real value on mount.
export const TableDialogContext = React.createContext<TableDialogContextState>({
  setDialog: () => {},
  dialog: undefined,
  isDialogActive: () => false,
});

export const DecisionTableDialogProvider: React.FC<
  React.PropsWithChildren<{
    getContainer?: () => HTMLElement;
  }>
> = ({ children, getContainer }) => {
  const [dialog, setDialog] = useState<TableDialogState | undefined>(undefined);
  const isDialogActive = (type: TableDialogType) => {
    return dialog?.type === type;
  };

  return (
    <TableDialogContext.Provider
      value={{
        dialog,
        setDialog,
        isDialogActive,
        getContainer,
      }}
    >
      {children}
    </TableDialogContext.Provider>
  );
};

export const useDecisionTableDialog = () => React.useContext(TableDialogContext);
