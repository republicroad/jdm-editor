import { PencilIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';

export type VersionHistoryEntry = {
  revision: string;
  versionName?: string;
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
}

/**
 * 版本历史侧滑面板：列出某图的全部历史版本，支持恢复到任一版本、按名称/版本号
 * 过滤，以及命名版本的重命名（受控，宿主喂 adapter 数据与回调）。
 */
export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  open,
  onOpenChange,
  versions,
  currentRevision,
  loading = false,
  onRestore,
  onRename,
}) => {
  const [query, setQuery] = React.useState('');
  const [editing, setEditing] = React.useState<{ revision: string; draft: string } | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setEditing(null);
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? versions.filter(
        (entry) => (entry.versionName ?? '').toLowerCase().includes(q) || entry.revision.toLowerCase().includes(q),
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
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            {versions.length > 0
              ? `${versions.length} version(s). Restoring loads that version as the current one.`
              : 'No versions yet. Each save creates one.'}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className='-mx-2 min-h-0 flex-1 px-2'>
          {loading ? (
            <div className='px-2 py-6 text-center text-sm text-muted-foreground'>Loading…</div>
          ) : versions.length === 0 ? (
            <div className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
              Save this graph to create its first version.
            </div>
          ) : (
            <div className='flex flex-col gap-2 py-1'>
              <Input
                aria-label='Filter versions'
                placeholder='Filter by name or revision…'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='h-8 text-sm'
              />
              {filtered.length === 0 ? (
                <div className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  No versions match “{query.trim()}”.
                </div>
              ) : (
                <ul className='flex flex-col gap-2'>
                  {filtered.map((entry) => {
                    const isCurrent = currentRevision === entry.revision;
                    const isEditing = editing?.revision === entry.revision;
                    return (
                      <li
                        key={entry.revision}
                        className='flex items-center justify-between gap-3 rounded-lg border bg-card/50 px-3 py-2.5'
                      >
                        <div className='min-w-0'>
                          <div className='flex items-center gap-2'>
                            {isEditing ? (
                              <Input
                                aria-label={`Rename version ${entry.revision}`}
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
                                {isCurrent && (
                                  <span className='rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary'>
                                    current
                                  </span>
                                )}
                              </>
                            )}
                          </div>
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
                                title='Rename version'
                                aria-label={`Rename version ${entry.revision}`}
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
                                title='Name this version'
                                aria-label={`Name version ${entry.revision}`}
                                onClick={() => setEditing({ revision: entry.revision, draft: '' })}
                              >
                                Name
                              </Button>
                            ))}
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={isCurrent}
                            onClick={() => onRestore(entry.revision)}
                          >
                            Restore
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
