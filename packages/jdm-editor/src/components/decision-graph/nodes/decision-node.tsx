import { CloseOutlined, MoreOutlined } from '#icons';
import { Badge } from '#reui/badge';
import { IconTile } from '#reui/icon-tile';
import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { match } from 'ts-pattern';

import { DiffIcon } from '../../diff-icon';
import { Button, Dropdown, type MenuProps, Typography } from '../../primitives';
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
  /** WS1-R7：仿真单节点轨迹——渲染为节点底部 run strip（耗时等） */
  trace?: { performance?: string | null; micros?: number; code?: string } | null;
  /** WS1-R7 增强：仿真失败节点的错误信息——code 优先，无 code 退化为紧凑 title，渲染为 strip 内错误码徽章 */
  traceError?: { code?: string | null; title?: string | null; message?: string | null } | null;
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
  type,
  children,
  actions = [],
  disabled = false,
  isSelected = false,
  noBodyPadding = false,
  color = 'primary',
  onNameChange,
  menuItems = [],
  status,
  trace,
  traceError,
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
      ? 'border-[var(--seal-color-success)] group-hover/dn:border-[var(--seal-color-success)]'
      : diffStatus === 'moved'
        ? 'border-[var(--seal-color-info)] group-hover/dn:border-[var(--seal-color-info)]'
        : diffStatus === 'modified'
          ? 'border-[var(--seal-color-warning)] group-hover/dn:border-[var(--seal-color-warning)]'
          : diffStatus === 'removed'
            ? 'border-[var(--destructive)] group-hover/dn:border-[var(--destructive)]'
            : isSelected
              ? 'border-[var(--seal-color-primary-active)] group-hover/dn:border-[var(--seal-color-primary-active)]'
              : '';

  const cardList = listMode ? 'rounded-none border-0 border-b border-b-[var(--seal-color-border-fade)]' : '';

  const statusBg =
    status === 'success'
      ? '[--node-background:var(--seal-color-success-bg)]'
      : status === 'error'
        ? '[--node-background:var(--seal-color-error-bg)]'
        : status === 'warning'
          ? '[--node-background:var(--seal-color-warning-bg)]'
          : '';

  return (
    <div
      className={clsx(
        'group/dn flex flex-col gap-2',
        '[--node-border-radius:8px] [--node-horizontal-padding:8px] [--node-small-text:12px]',
        '[--node-color:var(--primary)] [--node-background:var(--seal-color-bg-container)]',
        statusBg,
      )}
      style={
        {
          '--node-color': nodeColor,
        } as React.CSSProperties
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
                  className='flex justify-center items-center rounded-2xl w-4 h-4 text-[10px] font-bold text-[var(--muted-foreground)]'
                >
                  {h}
                </div>
              ))}
          {status === 'error' && (
            <div className='flex justify-center items-center rounded-2xl w-4 h-4 text-[10px] font-bold bg-[var(--destructive)] text-white'>
              <CloseOutlined />
            </div>
          )}
          <DiffIcon status={diffStatus} style={{ fontSize: 16 }} />
        </div>
        <div className={'grid p-2 gap-1.5 grid-cols-[min-content_1fr_min-content] items-center box-border min-h-10'}>
          <IconTile variant='solid' size='xs' className='bg-[var(--node-color)] text-white' aria-hidden>
            {icon}
          </IconTile>
          <div className='flex min-w-0 flex-col gap-0.5'>
            <TextEdit onChange={onNameChange} disabled={disabled} value={name} />
            {type != null && type !== '' && (
              <Badge variant='secondary' size='xs' className='w-fit max-w-full truncate'>
                {type}
              </Badge>
            )}
          </div>
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
              'p-2 border-t border-t-[var(--border)]',
              actions.length === 0 && 'rounded-[0_0_var(--node-border-radius)_var(--node-border-radius)]',
              noBodyPadding && 'p-0!',
            )}
          >
            {children}
          </div>
        )}
        {actions.length > 0 && (
          <div
            className={clsx(
              'nodrag bg-[var(--seal-color-primary-bg-fade)] overflow-hidden',
              'rounded-b-[var(--node-border-radius)] border-t border-t-[var(--seal-color-border-fade)]',
            )}
          >
            <div className='flex [&_button]:py-0.5 [&_button]:px-2 [&_button]:text-xs [&_button]:h-auto [&_button]:rounded-none [&_button]:text-[var(--muted-foreground)]'>
              {actions}
            </div>
          </div>
        )}
        {(trace || traceError) && (
          <div
            data-slot='node-run-strip'
            className='nodrag flex items-center justify-between gap-2 px-2 py-0.5 text-[10px] font-medium border-t border-t-[var(--seal-color-border-fade)] bg-[var(--seal-color-primary-bg-fade)] text-[var(--muted-foreground)]'
          >
            <span>TRACE</span>
            <span className='flex min-w-0 items-center gap-1.5'>
              {traceError && (
                <span
                  data-slot='node-run-strip-error'
                  className='max-w-36 truncate rounded-sm bg-[var(--seal-color-error)] px-1 py-px font-semibold text-white'
                  title={[traceError.title, traceError.message].filter(Boolean).join('\n') || undefined}
                >
                  {traceError.code || traceError.title}
                </span>
              )}
              {trace?.performance != null && <span>{trace.performance}</span>}
            </span>
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
                <div className='flex items-center justify-between pl-2.5 bg-[var(--seal-color-primary-bg-fade)] rounded-t-[var(--node-border-radius)] border-b border-b-[var(--border)]'>
                  <Typography.Text className='text-xs! text-[var(--muted-foreground)]'>{detailsTitle}</Typography.Text>
                  <Button
                    type={'text'}
                    size={'small'}
                    className='text-[var(--muted-foreground)] [font-size:0]!'
                    icon={<CloseOutlined style={{ fontSize: 8 }} />}
                    onClick={onDetailsClose}
                  />
                </div>
                <div className='flex flex-col p-2.5 gap-0.5 [&_.settings-form_.seal-ce]:text-xs'>{details}</div>
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
