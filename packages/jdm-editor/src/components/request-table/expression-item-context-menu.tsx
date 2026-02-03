import { Dropdown } from 'antd';
import React from 'react';

import { useTranslation } from '../../locales';
import { SpacedText } from '../spaced-text';
import { useExpressionStore } from './context/expression-store.context';

type ExpressionItemContextMenuProps = {
  index: number;
  children: React.ReactNode;
};

export const ExpressionItemContextMenu: React.FC<ExpressionItemContextMenuProps> = ({ index, children }) => {
  const { t } = useTranslation();
  const { addRowAbove, addRowBelow, disabled } = useExpressionStore(({ addRowBelow, addRowAbove, disabled }) => ({
    addRowBelow,
    addRowAbove,
    disabled,
  }));

  return (
    <Dropdown
      destroyPopupOnHide
      transitionName=''
      disabled={disabled}
      overlayStyle={{ minWidth: 200 }}
      trigger={['contextMenu']}
      menu={{
        items: [
          {
            key: 'addRowAbove',
            label: <SpacedText left={t('addRowAbove')} />,
            onClick: () => {
              addRowAbove(index);
            },
          },
          {
            key: 'addRowBelow',
            label: <SpacedText left={t('addRowBelow')} />,
            onClick: () => {
              addRowBelow(index);
            },
          },
        ],
      }}
    >
      {children}
    </Dropdown>
  );
};
