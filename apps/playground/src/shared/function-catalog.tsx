import { Badge } from '#components/reui/badge';
import { Sheet, SheetContent } from '#components/ui/sheet';
import type { CustomFunctionTool, CustomNodeNamespace } from '@republicroad/jdm-appshell';
import { Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';

/**
 * WS2 批 1（A1）：函数目录——浏览 zen-udf registry 的全部函数（按 pack/namespace
 * 分组），展示签名/参数/返回/文档，一键插入画布或送入 REPL 试运行。
 * 数据源 = EditorShell 的 schema（udfFunctionSchemaNamespaces 端点），无状态、无租户。
 */
export const FunctionCatalog: React.FC<{
  schema: CustomNodeNamespace[] | null;
  open: boolean;
  onClose: () => void;
  onInsert: (tool: CustomFunctionTool) => void;
  /** 批 2（A3）：送入 REPL 试运行 */
  onTry?: (tool: CustomFunctionTool) => void;
}> = ({ schema, open, onClose, onInsert, onTry }) => {
  const [search, setSearch] = useState('');

  const namespaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (schema ?? [])
      .map((ns) => ({
        ...ns,
        tools: (ns.tools ?? []).filter(
          (tool) =>
            !q ||
            tool.name.toLowerCase().includes(q) ||
            (tool.title ?? '').toLowerCase().includes(q) ||
            (tool.description ?? '').toLowerCase().includes(q),
        ),
      }))
      .filter((ns) => ns.tools.length > 0);
  }, [schema, search]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side='right' className='flex w-[520px] flex-col gap-3 overflow-y-auto sm:max-w-[520px]'>
        <div className='flex items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1.5'>
          <Search className='size-3.5 text-[var(--muted-foreground)]' />
          <input
            className='w-full bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]'
            placeholder='搜索函数 / 描述…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {namespaces.length === 0 && (
          <div className='py-6 text-center text-xs text-[var(--muted-foreground)]'>
            {schema?.length ? '无匹配函数' : 'schema 未加载（demo-server 不可达？）'}
          </div>
        )}

        {namespaces.map((ns) => (
          <div key={ns.name} className='flex flex-col gap-2'>
            <div className='flex items-baseline gap-2 border-b border-[var(--border)] pb-1'>
              <span className='text-[13px] font-semibold'>{ns.title}</span>
              <span className='text-[11px] text-[var(--muted-foreground)]'>
                {ns.name}
                {ns.description ? ` — ${ns.description}` : ''}
              </span>
            </div>
            {ns.tools.map((tool) => {
              const params = Object.entries(tool.parameters?.properties ?? {});
              const required = new Set(tool.parameters?.required ?? []);
              return (
                <div
                  key={tool.name}
                  className={
                    'rounded-md border p-2.5 ' +
                    (tool.deprecated
                      ? 'border-[var(--seal-color-warning)]/60 bg-[var(--seal-color-warning-bg)]'
                      : 'border-[var(--border)]')
                  }
                >
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <span className='text-xs font-semibold'>{tool.title}</span>{' '}
                      <code className='rounded bg-[var(--muted)] px-1 py-0.5 text-[11px]'>
                        {tool.name}({params.map(([n]) => n).join(', ')})
                      </code>
                      {tool.deprecated && (
                        <Badge variant='secondary' className='ml-1 align-middle'>
                          已弃用{tool.deprecated.since ? ` ${tool.deprecated.since}` : ''}
                        </Badge>
                      )}
                    </div>
                    <div className='flex shrink-0 gap-1'>
                      <button
                        className='rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] hover:bg-[var(--accent)]'
                        onClick={() => onInsert(tool)}
                      >
                        插入画布
                      </button>
                      {onTry && (
                        <button
                          className='rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] hover:bg-[var(--accent)]'
                          onClick={() => onTry(tool)}
                        >
                          试运行
                        </button>
                      )}
                    </div>
                  </div>
                  {tool.description && (
                    <p className='mb-1 mt-0.5 text-[11px] text-[var(--muted-foreground)]'>{tool.description}</p>
                  )}
                  {tool.deprecated?.note && (
                    <p className='mb-1 text-[11px] text-[var(--seal-color-warning)]'>
                      ⚠ {tool.deprecated.note}
                      {tool.deprecated.since ? `（自 ${tool.deprecated.since} 起）` : ''}
                    </p>
                  )}
                  {params.length > 0 && (
                    <div className='mt-1 flex flex-col gap-0.5'>
                      {params.map(([name, p]) => (
                        <div key={name} className='flex items-baseline gap-1.5 text-[11px]'>
                          <span className='font-mono'>{name}</span>
                          <span className='text-[var(--muted-foreground)]'>{p.type ?? 'any'}</span>
                          {required.has(name) ? <Badge variant='outline'>required</Badge> : null}
                          {p.description ? (
                            <span className='truncate text-[var(--muted-foreground)]'>{p.description}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className='mt-1 text-[11px] text-[var(--muted-foreground)]'>
                    返回: {tool.returns?.type ?? 'any'}
                    {tool.returns?.description ? ` — ${tool.returns.description}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </SheetContent>
    </Sheet>
  );
};
