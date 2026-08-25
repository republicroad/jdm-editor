import { CloseOutlined, MoreOutlined } from '@/icons';
import { Button, Dropdown, type MenuProps, Typography } from '../../primitives';
import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { match } from 'ts-pattern';

import { DiffIcon } from '../../diff-icon';
import { TextEdit } from '../../text-edit';
import { GraphCard } from './graph-card';
import { NodeColor } from './specifications/colors';

export type DecisionNodeProps = {
  name?: string;
  icon: React.ReactNode;
  type: React.ReactNode;
  helper?: (React.ReactNode | false)[];
  disabled?: boolean;
  isSelected?: boolean;
  children?: React.ReactNode;
  actions?: React.ReactNode[];
  status?: 'error' | 'success' | 'warning';
  diffStatus?: 'removed' | 'added' | 'modified' | 'moved';
  noBodyPadding?: boolean;
  color?: 'primary' | 'secondary' | string;
  menuItems?: MenuProps['items'];
  onNameChange?: (name: string) => void;
  compactMode?: boolean;
  listMode?: boolean;
  details?: React.ReactNode;
  detailsOpen?: boolean;
  detailsTitle?: string;
  onDetailsClose?: () => void;
};

export const DecisionNode: React.FC<DecisionNodeProps> = ({
  icon,
  name,
  children,
  actions = [],
  disabled = false,
  isSelected = false,
  noBodyPadding = false,
  color = 'primary',
  onNameChange,
  menuItems = [],
  status,
  diffStatus,
  compactMode,
  listMode,
  helper,
  details,
  detailsOpen = false,
  detailsTitle = 'Details',
  onDetailsClose,
}) => {
  const nodeColor = match(color)
    .with('primary', () => NodeColor.Blue)
    .otherwise((c) => c);

  const cardBorder =
    diffStatus === 'added'
      ? 'border-[var(--grl-color-success)] group-hover/dn:border-[var(--grl-color-success)]'
      : diffStatus === 'moved'
        ? 'border-[var(--grl-color-info)] group-hover/dn:border-[var(--grl-color-info)]'
        : diffStatus === 'modified'
          ? 'border-[var(--grl-color-warning)] group-hover/dn:border-[var(--grl-color-warning)]'
          : diffStatus === 'removed'
            ? 'border-[var(--grl-color-error)] group-hover/dn:border-[var(--grl-color-error)]'
            : isSelected
              ? 'border-[var(--grl-color-primary-active)] group-hover/dn:border-[var(--grl-color-primary-active)]'
              : '';

  const cardList = listMode ? 'rounded-none border-0 border-b border-b-[var(--grl-color-border-fade)]' : '';

  const statusBg =
    status === 'success'
      ? '[--node-background:var(--grl-color-success-bg)]'
      : status === 'error'
        ? '[--node-background:var(--grl-color-error-bg)]'
        : status === 'warning'
          ? '[--node-background:var(--grl-color-warning-bg)]'
          : '';

  return (
    <div
      className={clsx(
        'group/dn flex flex-col gap-2',
        '[--node-border-radius:8px] [--node-horizontal-padding:8px] [--node-small-text:12px]',
        '[--node-color:var(--grl-color-primary)] [--node-background:var(--grl-color-bg-container)]',
        statusBg,
      )}
      style={
        {
          '--node-color': nodeColor,
        } as any
      }
      onKeyDown={(e) => e.stopPropagation()}
      data-diff={diffStatus}
      data-compact={compactMode || undefined}
    >
      <GraphCard className={clsx(cardBorder, cardList)}>
        <div className='absolute -top-5 w-full h-4 text-[10px] font-bold flex justify-end items-center gap-1'>
          {Array.isArray(helper) &&
            helper
              .filter((h) => !!h)
              .map((h, i) => (
                <div
                  key={i}
                  className='flex justify-center items-center rounded-2xl w-4 h-4 text-[10px] font-bold text-[var(--grl-color-text-secondary)]'
                >
                  {h}
                </div>
              ))}
          {status === 'error' && (
            <div className='flex justify-center items-center rounded-2xl w-4 h-4 text-[10px] font-bold bg-[var(--grl-color-error)] text-white'>
              <CloseOutlined />
            </div>
          )}
          <DiffIcon status={diffStatus} style={{ fontSize: 16 }} />
        </div>
        <div className={'grid p-2 gap-0 grid-cols-[min-content_1fr_min-content] items-center box-border h-10'}>
          <div
            data-dn-icon
            className='flex justify-center items-center w-6 h-6 text-base rounded mr-0.5 text-white bg-[var(--node-color)]'
          >
            {icon}
          </div>
          <TextEdit onChange={onNameChange} disabled={disabled} value={name} />
          {menuItems.length > 0 && (
            <div className={clsx('nodrag')}>
              <Dropdown trigger={['click']} overlayStyle={{ minWidth: 250 }} menu={{ items: menuItems }}>
                <Button type='text' size={'small'} icon={<MoreOutlined />} />
              </Dropdown>
            </div>
          )}
        </div>
        {children && (
          <div
            className={clsx(
              'p-2 border-t border-t-[var(--grl-color-border)]',
              actions.length === 0 &&
                'rounded-[0_0_var(--node-border-radius)_var(--node-border-radius)]',
              noBodyPadding && 'p-0!',
            )}
          >
            {children}
          </div>
        )}
        {actions.length > 0 && (
          <div
            className={clsx(
              'nodrag bg-[var(--grl-color-primary-bg-fade)] overflow-hidden',
              'rounded-b-[var(--node-border-radius)] border-t border-t-[var(--grl-color-border-fade)]',
            )}
          >
            <div className='flex [&_button]:py-0.5 [&_button]:px-2 [&_button]:text-xs [&_button]:h-auto [&_button]:rounded-none [&_button]:text-[var(--grl-color-text-secondary)]'>
              {actions}
            </div>
          </div>
        )}
      </GraphCard>
      <TransitionMount state={detailsOpen} timeout={100}>
        {(stage, shouldMount) =>
          shouldMount && (
            <GraphCard
              className='nodrag'
              style={{
                transition: '0.1s ease-in-out',
                transform: stage === 'enter' ? 'translateY(0)' : 'translateY(-10px)',
                opacity: stage === 'enter' ? 1 : 0,
              }}
            >
              <div className='flex flex-col'>
                <div className='flex items-center justify-between pl-2.5 bg-[var(--grl-color-primary-bg-fade)] rounded-t-[var(--node-border-radius)] border-b border-b-[var(--grl-color-border)]'>
                  <Typography.Text className='text-xs! text-[var(--grl-color-text-secondary)]'>
                    {detailsTitle}
                  </Typography.Text>
                  <Button
                    type={'text'}
                    size={'small'}
                    className='text-[var(--grl-color-text-secondary)] [font-size:0]!'
                    icon={<CloseOutlined style={{ fontSize: 8 }} />}
                    onClick={onDetailsClose}
                  />
                </div>
                <div className='flex flex-col p-2.5 gap-0.5 [&_.settings-form_.grl-ce]:text-xs'>{details}</div>
              </div>
            </GraphCard>
          )
        }
      </TransitionMount>
    </div>
  );
};

const TRANSITION_TIMEOUT = 100;

const TransitionMount: React.FC<{
  state: boolean;
  timeout?: number;
  children: (stage: 'enter' | 'leave', shouldMount: boolean) => React.ReactNode;
}> = ({ state, timeout = TRANSITION_TIMEOUT, children }) => {
  const [shouldMount, setShouldMount] = useState(state);
  const [stage, setStage] = useState<'enter' | 'leave'>(state ? 'enter' : 'leave');

  useEffect(() => {
    if (state) {
      setShouldMount(true);
      const frame = requestAnimationFrame(() => setStage('enter'));
      return () => cancelAnimationFrame(frame);
    }

    setStage('leave');
    const timer = setTimeout(() => setShouldMount(false), timeout);
    return () => clearTimeout(timer);
  }, [state, timeout]);

  return <>{children(stage, shouldMount)}</>;
};
