import type { DecisionFixture, FixtureReport } from '@republicroad/zen-udf';
import React, { useState } from 'react';

/**
 * WS2 批 3（A5）：决策夹具视图——把"样例 → 期望"测试闭环搬进编辑器。
 * 数据流：POST /v1/fixtures/execute（demo-server 的 runDecisionTests 包装）→
 * FixtureReport（逐夹具 pass/fail + actual vs expected）。
 * v1 夹具来源 = udf-fixtures.ts 的确定性断言（UI 内编辑留二期）。
 */
export const FunctionFixtures: React.FC<{
  fixtures: DecisionFixture[] | undefined;
  model: unknown;
  demoServer: string;
}> = ({ fixtures, model, demoServer }) => {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FixtureReport | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(`${demoServer}/v1/fixtures/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, fixtures }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json?.details === 'string' ? json.details : json?.error || `HTTP ${res.status}`);
      } else {
        setReport(json);
      }
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setRunning(false);
    }
  };

  if (!fixtures?.length) {
    return <div className='py-6 text-center text-xs text-[var(--muted-foreground)]'>此样例未附决策夹具</div>;
  }

  return (
    <div className='flex flex-col gap-2 p-2.5'>
      <div className='flex items-center gap-2'>
        <button
          className='rounded-md border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--accent)] disabled:opacity-50'
          onClick={() => void run()}
          disabled={running}
        >
          {running ? '执行中…' : '▶ 运行夹具'}
        </button>
        <span className='text-[11px] text-[var(--muted-foreground)]'>{fixtures.length} 条决策夹具（确定性断言）</span>
      </div>

      {error && (
        <div className='rounded-md bg-[var(--seal-color-error-bg)] p-2 text-[11px] text-[var(--seal-color-error)]'>
          {error}
        </div>
      )}

      {report && (
        <div className='flex flex-col gap-1.5'>
          <div className='text-[11px]'>
            通过 <span className='font-semibold text-[var(--seal-color-success)]'>{report.passed}</span> · 失败{' '}
            <span
              className={
                'font-semibold ' +
                (report.failed > 0 ? 'text-[var(--seal-color-error)]' : 'text-[var(--muted-foreground)]')
              }
            >
              {report.failed}
            </span>
          </div>
          {report.results.map((r) => (
            <div
              key={r.name}
              className={
                'flex items-baseline justify-between gap-2 rounded-md border px-2 py-1 text-[11px] ' +
                (r.passed
                  ? 'border-[var(--seal-color-success)]/40 bg-[var(--seal-color-success-bg)]'
                  : 'border-[var(--seal-color-error)]/40 bg-[var(--seal-color-error-bg)]')
              }
            >
              <span className='font-mono'>{r.name}</span>
              {r.passed ? (
                <span className='text-[var(--muted-foreground)]'>PASS</span>
              ) : (
                <span
                  className='min-w-0 truncate text-[var(--seal-color-error)]'
                  title={r.error || JSON.stringify(r.actual)}
                >
                  {r.error || 'FAIL'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
