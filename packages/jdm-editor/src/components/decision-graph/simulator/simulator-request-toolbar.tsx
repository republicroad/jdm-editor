import { CopyOutlined, FormatPainterOutlined, PlayCircleOutlined } from '@/icons';
import InformationIcon from '@/reui/icons/animated/outline/information';
import LinkIcon from '@/reui/icons/animated/outline/link';
import React from 'react';

import type { TranslationKey } from '../../../theming/i18n';
import { Button, Select, Tooltip, Typography } from '../../primitives';

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
    <div className='flex items-center justify-between gap-2 border-b border-border px-3 py-2'>
      <Tooltip title={t('simulator.description')}>
        <Typography.Text
          className='min-w-0 shrink cursor-help overflow-hidden text-ellipsis whitespace-nowrap'
          style={{ fontSize: 13 }}
        >
          {t('request')}
          <span className='ml-1 inline-flex align-super opacity-50 [&_svg]:block'>
            <InformationIcon className='size-2.5' />
          </span>
        </Typography.Text>
      </Tooltip>
      {shouldShowSimulatorSourceSelect && (
        <Tooltip title={t('simulator.currentBinding')}>
          <div className='flex min-w-0 items-center gap-1'>
            <LinkIcon className='size-3 shrink-0 text-[var(--muted-foreground)]' />
            <Select
              size='small'
              value={boundRequestSourceIndex}
              options={sourceOptions}
              popupMatchSelectWidth={false}
              onChange={onSourceChange}
            />
          </div>
        </Tooltip>
      )}
      {bindingName && !shouldShowSimulatorSourceSelect && (
        <Typography.Text type='secondary' className='flex min-w-0 items-center gap-1 text-xs'>
          <Tooltip title={t('simulator.currentBinding')}>
            <LinkIcon className='size-3 shrink-0 text-[var(--muted-foreground)]' />
          </Tooltip>
          <span className='truncate'>{bindingName}</span>
        </Typography.Text>
      )}
      <div className='flex shrink-0 items-center gap-1'>
        {onRun && (
          <React.Fragment>
            <Tooltip title={!hasInputNode ? t('simulator.nodeRequired') : undefined}>
              <Tooltip title={t('common.format')}>
                <Button size='small' type='text' shape='circle' icon={<FormatPainterOutlined />} onClick={onFormat} />
              </Tooltip>
            </Tooltip>
            <Tooltip title={t('dg.jsonSchema.copyJson')}>
              <Button size='small' type='text' shape='circle' icon={<CopyOutlined />} onClick={onCopy} />
            </Tooltip>
            <Tooltip title={t('simulator.run')}>
              <Button
                size='small'
                type='primary'
                shape='circle'
                loading={loading}
                icon={<PlayCircleOutlined />}
                disabled={!hasInputNode}
                onClick={onRun}
              />
            </Tooltip>
          </React.Fragment>
        )}
      </div>
    </div>
  );
};
