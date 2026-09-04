import * as React from 'react';

import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';

export type VersionHistoryEntry = {
  revision: string;
  updatedAt?: string;
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
}

/**
 * 版本历史侧滑面板：列出某图的全部历史版本，支持恢复到任一版本。
 * 数据由宿主喂入(受控组件)——adapter 装配留在宿主(shell 模式)。
 */
export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  open,
  onOpenChange,
  versions,
  currentRevision,
  loading = false,
  onRestore,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            {versions.length > 0
              ? `${versions.length} version(s). Restoring loads that version as the current one.`
              : 'No versions yet. Each save creates one.'}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="-mx-2 min-h-0 flex-1 px-2">
          {loading ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : versions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Save this graph to create its first version.
            </div>
          ) : (
            <ul className="flex flex-col gap-2 py-1">
              {versions.map((entry) => {
                const isCurrent = currentRevision === entry.revision;
                return (
                  <li
                    key={entry.revision}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{entry.revision}</span>
                        {isCurrent && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                            current
                          </span>
                        )}
                      </div>
                      {entry.updatedAt && (
                        <div className="truncate text-xs text-muted-foreground">{entry.updatedAt}</div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isCurrent}
                      onClick={() => onRestore(entry.revision)}
                    >
                      Restore
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
