import { type GraphDiff, useT } from '@republicroad/jdm-editor';
import { ChevronDownIcon, ChevronRightIcon, PencilIcon, PinIcon, PinOffIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';

export type VersionHistoryEntry = {
  revision: string;
  versionName?: string;
  pinned?: boolean;
  updatedAt?: string;
  auto?: boolean;
};

export interface VersionHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: VersionHistoryEntry[];
  /** 当前所在版本(列表中禁用其恢复入口)；缺省 = head */
  currentRevision?: string;
  loading?: boolean;
  /** 恢复指定版本(宿主实现：确认对话框 + load) */
  onRestore: (revision: string) => void;
  /** 重命名/清除版本命名(宿主实现：adapter.renameVersion)；未提供则隐藏重命名入口 */
  onRename?: (revision: string, versionName: string | null) => void;
  /**
   * 版本差异摘要（可选，宿主计算：以各版本的前一版本为基线跑 computeGraphDiff，
   * 键 = 版本 revision）。提供后条目显示 +/−/~ 摘要，点击展开变更明细。
   */
  diffs?: Record<string, GraphDiff>;
  /** 钉住/取消钉住版本(宿主实现：adapter.updateVersionMeta)；未提供则隐藏钉住入口 */
  onPin?: (revision: string, pinned: boolean) => void;
  /**
   * 画布对比指定版本(宿主实现：载入该版本内容作为 DecisionGraph.diffBaseline；
   * 传 null = 退出对比)；未提供则隐藏对比入口。
   */
  onCompare?: (revision: string | null) => void;
  /** 当前正在对比的版本 revision：其条目显示「对比中」徽标，对比入口呈退出态 */
  comparingRevision?: string;
}

/** 版本差异摘要行：+新增 / −删除 / ~修改（节点与边合并计数），点击展开变更明细 */
const DiffSummary: React.FC<{ diff: GraphDiff; expanded: boolean; onToggle: () => void }> = ({
  diff,
  expanded,
  onToggle,
}) => {
  const t = useT();
  if (diff.unchanged) {
    return <div className='text-xs text-muted-foreground'>{t('vh.noChanges')}</div>;
  }

  const counts = [
    { label: 'added', value: diff.addedNodes.length + diff.addedEdges.length },
    { label: 'removed', value: diff.removedNodes.length + diff.removedEdges.length },
    { label: 'modified', value: diff.modifiedNodes.length + diff.modifiedEdges.length },
  ];
  const groups = [
    { changes: [...diff.addedNodes, ...diff.addedEdges], sign: '+' },
    { changes: [...diff.removedNodes, ...diff.removedEdges], sign: '−' },
    { changes: [...diff.modifiedNodes, ...diff.modifiedEdges], sign: '~' },
  ];

  return (
    <div className='min-w-0'>
      <button
        type='button'
        className='flex cursor-pointer items-center gap-1.5 rounded px-0.5 py-0.5 text-xs hover:bg-accent'
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDownIcon className='h-3 w-3' /> : <ChevronRightIcon className='h-3 w-3' />}
        {counts.map(
          ({ label, value }) =>
            value > 0 && (
              <span
                key={label}
                className={
                  label === 'added'
                    ? 'font-medium text-emerald-600 dark:text-emerald-400'
                    : label === 'removed'
                      ? 'font-medium text-red-600 dark:text-red-400'
                      : 'font-medium text-amber-600 dark:text-amber-400'
                }
              >
                {label === 'added' ? `+${value}` : label === 'removed' ? `−${value}` : `~${value}`}
              </span>
            ),
        )}
        <span className='text-muted-foreground'>{t('vh.changes')}</span>
      </button>
      {expanded && (
        <ul className='mt-1 flex flex-col gap-0.5 border-l pl-3 text-xs text-muted-foreground'>
          {groups.map(({ changes, sign }, group) =>
            changes.map((change) => (
              <li key={`${group}-${change.id}`}>
                <span
                  className={
                    sign === '+'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : sign === '−'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                  }
                >
                  {sign}
                </span>{' '}
                {change.name ?? change.id}
                {change.name && change.name !== change.id && (
                  <span className='ml-1 font-mono opacity-70'>{change.id}</span>
                )}
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
};

/**
 * 版本历史侧滑面板：列出某图的全部历史版本，支持恢复到任一版本、按名称/版本号
 * 过滤、命名版本的重命名，以及可选的版本差异摘要（受控，宿主喂 adapter 数据与回调）。
 */
export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  open,
  onOpenChange,
  versions,
  currentRevision,
  loading = false,
  onRestore,
  onRename,
  diffs,
  onPin,
  onCompare,
  comparingRevision,
}) => {
  const t = useT();
  const [query, setQuery] = React.useState('');
  const [editing, setEditing] = React.useState<{ revision: string; draft: string } | null>(null);
  const [expandedDiff, setExpandedDiff] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setEditing(null);
      setExpandedDiff(null);
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? versions.filter(
        (entry) =>
          (entry.versionName ?? '').toLowerCase().includes(q) ||
          entry.revision.toLowerCase().includes(q) ||
          (q === 'pinned' && entry.pinned),
      )
    : versions;

  const commitRename = () => {
    if (!editing) return;
    const name = editing.draft.trim();
    if (name !== (versions.find((v) => v.revision === editing.revision)?.versionName ?? '')) {
      onRename?.(editing.revision, name === '' ? null : name);
    }
    setEditing(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='flex w-full flex-col gap-4 sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{t('vh.title')}</SheetTitle>
          <SheetDescription>
            {versions.length > 0 ? t('vh.description.some', { count: versions.length }) : t('vh.description.none')}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className='-mx-2 min-h-0 flex-1 px-2'>
          {loading ? (
            <div className='px-2 py-6 text-center text-sm text-muted-foreground'>Loading…</div>
          ) : versions.length === 0 ? null : (
            <div className='flex flex-col gap-2 py-1'>
              <Input
                aria-label={t('vh.filter.label')}
                placeholder={t('vh.filter.placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='h-8 text-sm'
              />
              {filtered.length === 0 ? (
                <div className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  {t('vh.filter.noMatch', { query: query.trim() })}
                </div>
              ) : (
                <ul className='flex flex-col gap-2'>
                  {filtered.map((entry) => {
                    const isCurrent = currentRevision === entry.revision;
                    const isEditing = editing?.revision === entry.revision;
                    const diff = diffs?.[entry.revision];
                    return (
                      <li
                        key={entry.revision}
                        className='flex items-center justify-between gap-3 rounded-lg border bg-card/50 px-3 py-2.5'
                      >
                        <div className='min-w-0 flex-1'>
                          <div className='flex items-center gap-2'>
                            {isEditing ? (
                              <Input
                                aria-label={t('vh.rename.aria', { revision: entry.revision })}
                                autoFocus
                                value={editing.draft}
                                onChange={(e) => setEditing({ revision: entry.revision, draft: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitRename();
                                  if (e.key === 'Escape') setEditing(null);
                                }}
                                onBlur={commitRename}
                                placeholder='Version name'
                                className='h-7 text-sm'
                              />
                            ) : (
                              <>
                                <span className='font-mono text-sm font-medium'>{entry.revision}</span>
                                {entry.versionName && (
                                  <span
                                    className='truncate rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary'
                                    title={entry.versionName}
                                  >
                                    {entry.versionName}
                                  </span>
                                )}
                                {entry.auto && (
                                  <span className='rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground'>
                                    auto
                                  </span>
                                )}
                                {entry.pinned && (
                                  <span className='rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400'>
                                    {t('vh.entry.pinned')}
                                  </span>
                                )}
                                {entry.revision === comparingRevision && (
                                  <span className='rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400'>
                                    {t('vh.compare.entry')}
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className='rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary'>
                                    current
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          {diff && !isEditing && (
                            <div className='mt-0.5'>
                              <DiffSummary
                                diff={diff}
                                expanded={expandedDiff === entry.revision}
                                onToggle={() =>
                                  setExpandedDiff(expandedDiff === entry.revision ? null : entry.revision)
                                }
                              />
                            </div>
                          )}
                          {entry.updatedAt && !isEditing && (
                            <div className='truncate text-xs text-muted-foreground'>{entry.updatedAt}</div>
                          )}
                        </div>
                        <div className='flex shrink-0 items-center gap-1'>
                          {onRename &&
                            !isEditing &&
                            (entry.versionName ? (
                              <Button
                                type='button'
                                variant='ghost'
                                size='icon'
                                className='h-8 w-8'
                                title={t('vh.rename.title')}
                                aria-label={t('vh.rename.aria', { revision: entry.revision })}
                                onClick={() => setEditing({ revision: entry.revision, draft: entry.versionName ?? '' })}
                              >
                                <PencilIcon className='h-3.5 w-3.5' />
                              </Button>
                            ) : (
                              <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                className='h-8 px-2 text-xs'
                                title={t('vh.name.button')}
                                aria-label={t('vh.name.aria', { revision: entry.revision })}
                                onClick={() => setEditing({ revision: entry.revision, draft: '' })}
                              >
                                {t('vh.name.button')}
                              </Button>
                            ))}
                          {onPin && !isEditing && (
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8'
                              title={entry.pinned ? t('vh.unpin.title') : t('vh.pin.title')}
                              aria-label={
                                entry.pinned
                                  ? t('vh.unpin.aria', { revision: entry.revision })
                                  : t('vh.pin.aria', { revision: entry.revision })
                              }
                              onClick={() => onPin(entry.revision, !entry.pinned)}
                            >
                              {entry.pinned ? (
                                <PinOffIcon className='h-3.5 w-3.5' />
                              ) : (
                                <PinIcon className='h-3.5 w-3.5' />
                              )}
                            </Button>
                          )}
                          {onCompare && !isEditing && (
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='h-8 px-2 text-xs'
                              disabled={isCurrent}
                              title={
                                entry.revision === comparingRevision
                                  ? t('vh.compare.exit.title')
                                  : t('vh.compare.title')
                              }
                              aria-label={
                                entry.revision === comparingRevision
                                  ? t('vh.compare.exit.aria', { revision: entry.revision })
                                  : t('vh.compare.aria', { revision: entry.revision })
                              }
                              onClick={() => onCompare(entry.revision === comparingRevision ? null : entry.revision)}
                            >
                              {entry.revision === comparingRevision
                                ? t('vh.compare.exit.button')
                                : t('vh.compare.button')}
                            </Button>
                          )}
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={isCurrent}
                            onClick={() => onRestore(entry.revision)}
                          >
                            {t('vh.restore')}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
