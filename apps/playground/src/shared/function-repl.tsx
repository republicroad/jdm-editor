import type { CustomNodeNamespace } from '@republicroad/jdm-appshell';
import React, { useEffect, useMemo, useState } from 'react';

/**
 * WS2 批 2（A3）：UDF 试运行 REPL——不经图直接调单个函数。
 * 数据流：选函数（schema 驱动参数表单）→ POST /v1/functions/:name/execute
 * （位置参数按 schema 属性序）→ 展示绑定 kwargs / 结果 / 耗时(µs)。
 */
export const FunctionRepl: React.FC<{
  schema: CustomNodeNamespace[] | null;
  /** 外部预选（目录"试运行"入口）；变化时切换选中函数 */
  toolName?: string;
  demoServer: string;
}> = ({ schema, toolName, demoServer }) => {
  const tools = useMemo(() => (schema ?? []).flatMap((ns) => ns.tools ?? []), [schema]);
  const [selected, setSelected] = useState<string>(toolName ?? tools[0]?.name ?? '');
  const [args, setArgs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ result: unknown; micros: number; kwargs: Record<string, unknown> } | null>(
    null,
  );

  const tool = tools.find((t) => t.name === (toolName ?? selected)) ?? tools[0];

  useEffect(() => {
    if (toolName) {
      setSelected(toolName);
      setArgs({});
      setOutcome(null);
      setError(null);
    }
  }, [toolName]);

  const selectTool = (name: string) => {
    setSelected(name);
    setArgs({});
    setOutcome(null);
    setError(null);
  };

  const paramEntries = useMemo(() => Object.entries(tool?.parameters?.properties ?? {}), [tool]);
  const requiredSet = useMemo(() => new Set(tool?.parameters?.required ?? []), [tool]);

  const run = async () => {
    if (!tool) return;
    setRunning(true);
    setError(null);
    setOutcome(null);
    try {
      // 位置参数按 schema 属性序：有输入用输入，否则回退参数默认值（服务端也会兜底）
      const argsArray = paramEntries.map(([name, p]) => {
        const raw = args[name];
        if (raw != null && raw !== '') {
          return p.type === 'number' || p.type === 'integer' ? Number(raw) : raw;
        }
        return p.default ?? (p.type === 'number' || p.type === 'integer' ? 0 : '');
      });
      const res = await fetch(`${demoServer}/v1/functions/${encodeURIComponent(tool.name)}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args: argsArray }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json?.details === 'string' ? json.details : json?.error || `HTTP ${res.status}`);
      } else {
        setOutcome(json);
      }
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setRunning(false);
    }
  };

  if (!tool) {
    return (
      <div className='py-6 text-center text-xs text-[var(--muted-foreground)]'>
        schema 未加载（demo-server 不可达？）
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-2 p-2.5'>
      <select
        className='rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs'
        value={tool.name}
        onChange={(e) => selectTool(e.target.value)}
      >
        {tools.map((t) => (
          <option key={t.name} value={t.name}>
            {t.title}（{t.name}）{t.deprecated ? ' — 已弃用' : ''}
          </option>
        ))}
      </select>

      {paramEntries.map(([name, p]) => (
        <label key={name} className='flex items-center gap-2 text-[11px]'>
          <span className='w-28 shrink-0 truncate font-mono'>
            {name}
            {requiredSet.has(name) ? <span className='text-[var(--seal-color-error)]'>*</span> : null}
          </span>
          <input
            className='min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)]'
            placeholder={p.description || `类型: ${p.type ?? 'any'}`}
            value={args[name] ?? (p.default != null ? String(p.default) : '')}
            onChange={(e) => setArgs((prev) => ({ ...prev, [name]: e.target.value }))}
          />
        </label>
      ))}

      <div className='flex items-center gap-2'>
        <button
          className='rounded-md border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--accent)] disabled:opacity-50'
          onClick={() => void run()}
          disabled={running}
        >
          {running ? '执行中…' : '▶ 运行'}
        </button>
        {outcome && <span className='text-[11px] text-[var(--muted-foreground)] tabular-nums'>{outcome.micros}µs</span>}
      </div>

      {error && (
        <div className='rounded-md bg-[var(--seal-color-error-bg)] p-2 text-[11px] text-[var(--seal-color-error)]'>
          {error}
        </div>
      )}
      {outcome && (
        <div className='flex flex-col gap-1 text-[11px]'>
          <div className='text-[var(--muted-foreground)]'>绑定 kwargs:</div>
          <pre className='overflow-x-auto rounded-md bg-[var(--muted)] p-2 font-mono'>
            {JSON.stringify(outcome.kwargs)}
          </pre>
          <div className='text-[var(--muted-foreground)]'>结果:</div>
          <pre className='overflow-x-auto rounded-md bg-[var(--muted)] p-2 font-mono'>
            {JSON.stringify(outcome.result)}
          </pre>
        </div>
      )}
    </div>
  );
};
