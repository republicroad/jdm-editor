import React from 'react';

import { ArrowDiffIcon } from '../arrow-diff-icon';
import { Space, Switch, type SwitchProps } from '../primitives';

export type DiffSwitchProps = {
  previousChecked?: boolean;
  displayDiff?: boolean;
} & SwitchProps;

export const DiffSwitch: React.FC<DiffSwitchProps> = ({ displayDiff, previousChecked, ...rest }) => {
  return (
    <Space size={4}>
      {displayDiff && (
        <>
          <Switch disabled={rest.disabled} size={'small'} checked={previousChecked} />
          <ArrowDiffIcon />
        </>
      )}
      <Switch size={'small'} {...rest} />
    </Space>
  );
};
