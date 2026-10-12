import { Alert, AlertDescription } from '#components/reui/alert';
import { Badge } from '#components/reui/badge';
import type { DecisionFixture, FixtureReport, FixtureResult } from '@republicroad/zen-udf';
import React, { useState } from 'react';

/**
 * WS2 批 3（A5）：决策夹具视图——把"样例 → 期望"测试闭环搬进编辑器。
 * 数据流：POST /v1/fixtures/execute（demo-server 的 runDecisionTests 包装）→
 * FixtureReport（逐夹具 pass/fail + actual vs expected）。
 * v1 夹具来源 = udf-fixtures.ts 的确定性断言（UI 内编辑留二期）。
 * 五列结果矩阵（A5 增强）：夹具 | 期望 | 实际 | 差异 | 判定——失败诊断
 * 不再靠 tooltip（期望列从夹具本体 join，实际/差异列来自 FixtureReport）。
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
        <Alert variant='destructive' className='text-[11px]'>
          <AlertDescription className='font-mono break-all'>{error}</AlertDescription>
        </Alert>
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
          <div className='grid grid-cols-[minmax(6rem,1.2fr)_1.5fr_1.5fr_1.5fr_4rem] gap-x-2 rounded-md bg-[var(--muted)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)]'>
            <span>夹具</span>
            <span>期望</span>
            <span>实际</span>
            <span>差异</span>
            <span className='text-right'>判定</span>
          </div>
          {report.results.map((r) => (
            <FixtureMatrixRow key={r.name} result={r} fixture={fixtures.find((f) => f.name === r.name)} />
          ))}
        </div>
      )}
    </div>
  );
};

const outcomeBadge = (r: FixtureResult): { label: string; className: string } =>
  r.passed
    ? { label: 'PASS', className: 'border-[var(--seal-color-success)]/40 text-[var(--seal-color-success)]' }
    : r.outcome === 'execution-error'
      ? { label: 'ERROR', className: 'border-[var(--seal-color-error)]/60 text-[var(--seal-color-error)]' }
      : { label: 'FAIL', className: 'border-[var(--seal-color-error)]/40 text-[var(--seal-color-error)]' };

/** 期望列文案（expect 四模：deep/path/expression/predicate；缺省 = smoke 语义） */
const describeExpect = (fixture: DecisionFixture | undefined): string => {
  const expect = fixture?.expect;
  if (!expect) return '(smoke：无异常即过)';
  switch (expect.mode) {
    case 'deep':
      return JSON.stringify(expect.value);
    case 'path':
      return `${expect.path} == ${JSON.stringify(expect.value)}`;
    case 'expression':
      return expect.source;
    case 'predicate':
      return '(进程内函数断言)';
    default:
      return '—';
  }
};

const truncated = (value: unknown, max = 96): string => {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const FixtureMatrixRow: React.FC<{ result: FixtureResult; fixture: DecisionFixture | undefined }> = ({
  result,
  fixture,
}) => {
  const badge = outcomeBadge(result);
  const diff = result.error ?? (result.passed ? '—' : '断言不符（见期望/实际列）');
  return (
    <div
      className={
        'grid grid-cols-[minmax(6rem,1.2fr)_1.5fr_1.5fr_1.5fr_4rem] items-baseline gap-x-2 rounded-md border px-2 py-1 text-[11px] ' +
        (result.passed
          ? 'border-[var(--seal-color-success)]/40 bg-[var(--seal-color-success-bg)]'
          : 'border-[var(--seal-color-error)]/40 bg-[var(--seal-color-error-bg)]')
      }
    >
      <span className='truncate font-mono' title={result.name}>
        {result.name}
      </span>
      <span className='truncate font-mono text-[var(--muted-foreground)]' title={describeExpect(fixture)}>
        {describeExpect(fixture)}
      </span>
      <span
        className='truncate font-mono text-[var(--muted-foreground)]'
        title={JSON.stringify(result.actual) ?? 'undefined'}
      >
        {truncated(result.actual)}
      </span>
      <span
        className={'truncate ' + (result.passed ? 'text-[var(--muted-foreground)]' : 'text-[var(--seal-color-error)]')}
        title={diff}
      >
        {diff}
      </span>
      <span className='text-right'>
        <Badge variant='outline' className={'px-1 py-0 text-[9px] ' + badge.className}>
          {badge.label}
        </Badge>
      </span>
    </div>
  );
};
