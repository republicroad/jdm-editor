import React from 'react';

import { ExpressionItemContextMenu as SharedContextMenu } from '../expression/expression-item-context-menu';
import { useExpressionStore } from './context/expression-store.context';

type ExpressionItemContextMenuProps = {
  index: number;
  children: React.ReactNode;
};

/** Thin adapter: wires the custom-function expression store into the shared menu. */
export const ExpressionItemContextMenu: React.FC<ExpressionItemContextMenuProps> = ({ index, children }) => {
  const { addRowAbove, addRowBelow, disabled } = useExpressionStore(({ addRowBelow, addRowAbove, disabled }) => ({
    addRowBelow,
    addRowAbove,
    disabled,
  }));

  return (
    <SharedContextMenu index={index} disabled={disabled} addRowAbove={addRowAbove} addRowBelow={addRowBelow}>
      {children}
    </SharedContextMenu>
  );
};
