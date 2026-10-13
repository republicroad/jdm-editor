import React from 'react';

import { useT } from '../../../theming/i18n';
import { Button, Tooltip, Typography } from '../../primitives';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { buildContractFixtures, listInputNodes } from './fixtures-run';
import type { ExampleRunReport } from './fixtures-runner';

/** Run all 结果矩阵（ADR-013 §3）：行序 = 用例序，「调试」= 选中 + 打开 simulator 抽屉 */
const RunMatrix: React.FC<{ report: ExampleRunReport; onDebug: (index: number) => void }> = ({ report, onDebug }) => {
  const t = useT();

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      {report.results.map((result, index) => (
        <div
          key={`${result.name}-${index}`}
          className='flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-xs last:border-b-0'
          data-outcome={result.outcome}
        >
          <span
            className={`w-16 shrink-0 font-medium ${
              result.outcome === 'passed'
                ? 'text-emerald-600 dark:text-emerald-400'
                : result.outcome === 'assertion-failed'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-destructive'
            }`}
          >
            {result.outcome === 'passed'
              ? t('request.outcomePassed')
              : result.outcome === 'assertion-failed'
                ? t('request.outcomeAssertionFailed')
                : t('request.outcomeExecutionError')}
          </span>
          <Typography.Text className='min-w-0 flex-1 truncate'>{result.name}</Typography.Text>
          {result.durationMs !== undefined && <span className='shrink-0 opacity-60'>{result.durationMs}ms</span>}
          {result.error && (
            <Tooltip title={result.error}>
              <span className='max-w-[240px] shrink-0 truncate text-destructive'>{result.error}</span>
            </Tooltip>
          )}
          <Button type='link' size='small' className='!px-1' onClick={() => onDebug(index)}>
            {t('request.debugInSimulator')}
          </Button>
        </div>
      ))}
    </div>
  );
};

/**
 * Fixtures 面板（分屏范式 §1.2）：Run all 的图级执行面，与 simulator 对称。
 * 域约束：规则图至多一个 inputNode——面板直接作用于它，无绑定概念。
 * 执行经 fixturesRunner 槽位（宿主注入 = simulateHandler 适配），kernel 零引擎依赖。
 */
export const FixturesPanel: React.FC = () => {
  const t = useT();
  const graphActions = useDecisionGraphActions();
  const { decisionGraph, panels, fixturesRunner, fixturesRun } = useDecisionGraphState(
    ({ decisionGraph, panels, fixturesRunner, fixturesRun }) => ({
      decisionGraph,
      panels,
      fixturesRunner,
      fixturesRun,
    }),
  );

  const inputNode = listInputNodes(decisionGraph)[0];
  const running = fixturesRun?.status === 'running';
  const hasExamples = Boolean(inputNode && buildContractFixtures(decisionGraph, inputNode.id));

  const debugFixture = (index: number) => {
    if (!inputNode) {
      return;
    }

    // 传选择不传状态：装载该示例到 simulator + 打开抽屉（完整 trace 在模拟器再跑获得）
    const fixtures = buildContractFixtures(decisionGraph, inputNode.id);
    const fixture = fixtures?.[index];
    if (!fixture) {
      return;
    }

    graphActions.setSimulatorRequest(JSON.stringify(fixture.input, null, 2));
    graphActions.setSimulatorExampleBinding({ nodeId: inputNode.id, sourceIndex: index, sourceName: fixture.name });
    const simulatorPanel = panels?.find((panel) => panel.id === 'simulator');
    if (simulatorPanel) {
      graphActions.setActivePanel(simulatorPanel.id);
    }
  };

  return (
    <div className='flex h-full flex-col overflow-hidden'>
      <div className='flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <Typography.Text strong className='truncate text-xs'>
            {inputNode?.name ?? t('request.fixturesNoInputNode')}
          </Typography.Text>
          {fixturesRun?.status === 'done' && fixturesRun.report && (
            <Typography.Text className='text-xs opacity-70'>
              {t('request.runAllPassed')} {fixturesRun.report.passed} · {t('request.runAllFailedCount')}{' '}
              {fixturesRun.report.failed}
            </Typography.Text>
          )}
        </div>
        <Button
          type='primary'
          size='small'
          disabled={!fixturesRunner || running || !inputNode || !hasExamples}
          onClick={() => {
            void graphActions.runFixtures();
          }}
        >
          {running ? t('request.fixturesRunning') : t('request.runAll')}
        </Button>
      </div>

      {inputNode && !hasExamples && (
        <div className='p-3 text-xs text-[var(--muted-foreground)]'>{t('request.fixturesNoExamples')}</div>
      )}

      {fixturesRun?.status === 'error' && (
        <div className='mx-3 mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive'>
          {fixturesRun.error === 'no-examples'
            ? t('request.fixturesNoExamples')
            : fixturesRun.error === 'no-input-node'
              ? t('request.fixturesNoInputNode')
              : (fixturesRun.error ?? t('request.runAllFailed'))}
        </div>
      )}

      {fixturesRun?.status === 'done' && fixturesRun.report && (
        <RunMatrix report={fixturesRun.report} onDebug={debugFixture} />
      )}
    </div>
  );
};
