import {
  CopyOutlined,
  FormatPainterOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Button, Select, Tooltip, Typography } from 'antd';
import React from 'react';

import type { TranslationKey } from '../../../locales';

export type SimulatorRequestToolbarProps = {
  t: (key: TranslationKey) => string;
  shouldShowSimulatorSourceSelect: boolean;
  boundRequestSourceIndex: number;
  sourceOptions: Array<{ value: number; label: string }>;
  bindingName?: string;
  hasInputNode?: boolean;
  loading?: boolean;
  onSourceChange: (sourceIndex: number) => void;
  onFormat: () => void;
  onCopy: () => void;
  onRun?: () => void;
};

export const SimulatorRequestToolbar: React.FC<SimulatorRequestToolbarProps> = ({
  t,
  shouldShowSimulatorSourceSelect,
  boundRequestSourceIndex,
  sourceOptions,
  bindingName,
  hasInputNode,
  loading,
  onSourceChange,
  onFormat,
  onCopy,
  onRun,
}) => {
  return (
    <div className={'grl-dg__simulator__section__bar grl-dg__simulator__section__bar--request'}>
      <Tooltip title={t('requestDescription')}>
        <Typography.Text
          style={{
            fontSize: 13,
            cursor: 'help',
            flexShrink: 1,
            minWidth: 0,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {t('request')}
          <InfoCircleOutlined
            style={{ fontSize: 10, marginLeft: 4, opacity: 0.5, verticalAlign: 'text-top' }}
          />
        </Typography.Text>
      </Tooltip>
      {shouldShowSimulatorSourceSelect && (
        <Tooltip title={t('requestCurrentDataSourceLabel')}>
          <div className={'grl-dg__simulator__section__bar__source-select'}>
            <LinkOutlined style={{ fontSize: 12, color: 'var(--grl-color-text-secondary)' }} />
            <Select
              size='small'
              variant='filled'
              value={boundRequestSourceIndex}
              options={sourceOptions}
              popupMatchSelectWidth={false}
              popupClassName={'grl-dg__simulator__section__bar__source-select-popup'}
              className={'grl-dg__simulator__section__bar__source-select__control'}
              onChange={onSourceChange}
            />
          </div>
        </Tooltip>
      )}
      {bindingName && !shouldShowSimulatorSourceSelect && (
        <Typography.Text className={'grl-dg__simulator__section__bar__source-select__label'} type='secondary'>
          <Tooltip title={t('requestCurrentDataSourceLabel')}>
            <LinkOutlined style={{ fontSize: 12, color: 'var(--grl-color-text-secondary)' }} />
          </Tooltip>{' '}
          {bindingName}
        </Typography.Text>
      )}
      <div className={'grl-dg__simulator__section__bar__actions'}>
        {onRun && (
          <Tooltip title={!hasInputNode ? t('requestNodeRequired') : undefined}>
            <Tooltip title={t('format')}>
              <Button size={'small'} type={'text'} shape={'circle'} icon={<FormatPainterOutlined />} onClick={onFormat} />
            </Tooltip>
            <Tooltip title={t('copyJson')}>
              <Button size={'small'} type={'text'} shape={'circle'} icon={<CopyOutlined />} onClick={onCopy} />
            </Tooltip>
            <Tooltip title={t('run')}>
              <Button
                size={'small'}
                type={'primary'}
                shape={'circle'}
                loading={loading}
                icon={<PlayCircleOutlined />}
                disabled={!hasInputNode}
                onClick={onRun}
              />
            </Tooltip>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
