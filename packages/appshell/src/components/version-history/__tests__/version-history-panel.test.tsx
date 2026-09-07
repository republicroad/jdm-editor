// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { type VersionHistoryEntry, VersionHistoryPanel } from '../version-history-panel';

// vitest globals 关闭时 RTL 不会自动清理，跨测试的 portal 残留会让查询多实例命中
afterEach(cleanup);

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

  test('命名版本展示名称徽标', () => {
    renderPanel({ versions: [entry('v1', { versionName: 'baseline' }), entry('v2')] });
    expect(screen.getByText('baseline')).toBeInTheDocument();
  });

  test('未提供 onRename 时不渲染命名/重命名入口', () => {
    renderPanel({ versions: [entry('v1', { versionName: 'baseline' })] });
    expect(screen.queryByRole('button', { name: /name version v1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename version v1/i })).not.toBeInTheDocument();
  });

  test('未命名版本：Name → 输入 + Enter 触发 onRename', () => {
    const onRename = vi.fn();
    renderPanel({ versions: [entry('v1')], onRename });
    fireEvent.click(screen.getByRole('button', { name: 'Name version v1' }));

    const input = screen.getByLabelText('Rename version v1');
    fireEvent.change(input, { target: { value: 'release-1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledExactlyOnceWith('v1', 'release-1');
  });

  test('已命名版本：铅笔进入编辑（预填原名），清空 + Enter 触发清除（null）', () => {
    const onRename = vi.fn();
    renderPanel({ versions: [entry('v1', { versionName: 'baseline' })], onRename });
    fireEvent.click(screen.getByRole('button', { name: 'Rename version v1' }));

    const input = screen.getByLabelText('Rename version v1') as HTMLInputElement;
    expect(input.value).toBe('baseline');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledExactlyOnceWith('v1', null);
  });

  test('Escape 取消编辑不触发 onRename', () => {
    const onRename = vi.fn();
    renderPanel({ versions: [entry('v1')], onRename });
    fireEvent.click(screen.getByRole('button', { name: 'Name version v1' }));

    const input = screen.getByLabelText('Rename version v1');
    fireEvent.change(input, { target: { value: 'draft' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText('v1')).toBeInTheDocument();
  });

  test('过滤框按名称或版本号子串过滤', () => {
    renderPanel({
      versions: [entry('v1', { versionName: 'baseline' }), entry('v2'), entry('v3', { versionName: 'Hotfix' })],
    });

    const filter = screen.getByLabelText('Filter versions');
    fireEvent.change(filter, { target: { value: 'base' } });
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.queryByText('v2')).not.toBeInTheDocument();

    fireEvent.change(filter, { target: { value: 'V3' } });
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.queryByText('v1')).not.toBeInTheDocument();

    fireEvent.change(filter, { target: { value: 'nope' } });
    expect(screen.getByText(/No versions match/i)).toBeInTheDocument();
  });

  test('diffs：条目显示 +/−/~ 摘要，点击展开变更明细', () => {
    const diffs = {
      v2: {
        addedNodes: [{ id: 'n3', name: 'New node' }],
        removedNodes: [{ id: 'n1' }],
        modifiedNodes: [{ id: 'n2', name: 'Table', fields: ['content'] }],
        addedEdges: [],
        removedEdges: [],
        modifiedEdges: [],
        unchanged: false,
      },
    };
    renderPanel({ diffs });

    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('−1')).toBeInTheDocument();
    expect(screen.getByText('~1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('New node')).toBeInTheDocument();
    expect(screen.getByText('n1')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
  });

  test('diffs：无变化版本显示 No changes，且不可展开', () => {
    renderPanel({
      diffs: {
        v1: {
          addedNodes: [],
          removedNodes: [],
          modifiedNodes: [],
          addedEdges: [],
          removedEdges: [],
          modifiedEdges: [],
          unchanged: true,
        },
      },
    });

    expect(screen.getByText('No changes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { expanded: false })).not.toBeInTheDocument();
  });
});
