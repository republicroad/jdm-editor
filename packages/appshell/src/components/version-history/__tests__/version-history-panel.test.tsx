// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';

import { type VersionHistoryEntry, VersionHistoryPanel } from '../version-history-panel';

const entry = (revision: string, extra: Partial<VersionHistoryEntry> = {}): VersionHistoryEntry => ({
  revision,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const renderPanel = (props: Partial<Parameters<typeof VersionHistoryPanel>[0]> = {}) => {
  const onRestore = vi.fn();
  render(
    <VersionHistoryPanel
      open
      onOpenChange={() => {}}
      versions={[entry('v1'), entry('v2', { auto: true }), entry('v3')]}
      onRestore={onRestore}
      {...props}
    />,
  );
  return onRestore;
};

describe('VersionHistoryPanel', () => {
  test('关闭态不渲染任何内容（radix portal 不落 DOM）', () => {
    render(<VersionHistoryPanel open={false} onOpenChange={() => {}} versions={[]} onRestore={() => {}} />);
    expect(screen.queryByText('Version history')).not.toBeInTheDocument();
  });

  test('空列表显示引导文案', () => {
    render(<VersionHistoryPanel open onOpenChange={() => {}} versions={[]} onRestore={() => {}} />);
    expect(screen.getByText('No versions yet. Each save creates one.')).toBeInTheDocument();
  });

  test('loading 态优先于列表', () => {
    render(<VersionHistoryPanel open onOpenChange={() => {}} versions={[entry('v1')]} loading onRestore={() => {}} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('v1')).not.toBeInTheDocument();
  });

  test('列出版本：revision 可见，auto 徽标仅标记 auto 条目', () => {
    renderPanel();
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getAllByText('auto')).toHaveLength(1);
  });

  test('currentRevision：对应条目带 current 徽标且 Restore 禁用', () => {
    renderPanel({ currentRevision: 'v3' });
    expect(screen.getByText('current')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button', { name: 'Restore' });
    expect(buttons).toHaveLength(3);
    expect(buttons[2]).toBeDisabled();
    expect(buttons[0]).toBeEnabled();
  });

  test('currentRevision 缺省 = head：全部条目可恢复', () => {
    renderPanel();
    screen.getAllByRole('button', { name: 'Restore' }).forEach((b) => expect(b).toBeEnabled());
  });

  test('Restore 回调携带所点条目的 revision', () => {
    const onRestore = renderPanel();
    fireEvent.click(screen.getAllByRole('button', { name: 'Restore' })[1]);
    expect(onRestore).toHaveBeenCalledExactlyOnceWith('v2');
  });

  test('updatedAt 时间戳展示在条目内', () => {
    renderPanel({ versions: [entry('v1', { updatedAt: '2026-09-06T12:00:00.000Z' })] });
    expect(screen.getByText('2026-09-06T12:00:00.000Z')).toBeInTheDocument();
  });
});
