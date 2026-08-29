import React from 'react';

import { useT } from '../../../theming/i18n';
import { Dropdown } from '../../primitives';
import { SpacedText } from '../../spaced-text';
import { useDecisionTableActions, useDecisionTableState } from '../context/dt-store.context';

const ContextMenu: React.FC<React.PropsWithChildren> = (props) => {
  const t = useT();
  const { children } = props;

  const tableActions = useDecisionTableActions();
  const { cursor, disabled } = useDecisionTableState(({ cursor, disabled }) => ({
    cursor,
    disabled,
  }));

  return (
    <Dropdown
      destroyPopupOnHide
      transitionName=''
      disabled={disabled}
      overlayStyle={{
        minWidth: 270,
      }}
      menu={{
        items: [
          {
            key: 'addRowAbove',
            label: <SpacedText left={t('dt.toolbar.addRowAbove')} />,
            onClick: () => {
              if (cursor) tableActions.addRowAbove(cursor?.y);
            },
          },
          {
            key: 'addRowBelow',
            label: <SpacedText left={t('dt.toolbar.addRowBelow')} />,
            onClick: () => {
              if (cursor) tableActions.addRowBelow(cursor?.y);
            },
          },
          {
            type: 'divider',
          },
          {
            key: 'remove',
            label: <SpacedText left={t('dt.toolbar.removeRow')} />,
            onClick: () => {
              if (cursor) tableActions.removeRow(cursor?.y);
            },
          },
        ],
      }}
      trigger={['contextMenu']}
    >
      {children}
    </Dropdown>
  );
};

export const TableContextMenu = React.memo(ContextMenu);
