import { WarningOutlined } from '#icons';
import { Alert, AlertAction, AlertTitle } from '#reui/alert';
import React, { useMemo, useState } from 'react';
import { P, match } from 'ts-pattern';

import { resolveFunctionScope } from '../../../helpers/custom-function-schema';
import {
  buildInstanceViews,
  computeFunctionArgsDrift,
  computeInstanceSchedule,
  editorValueToNamedCall,
  fillMissingFunctionArgs,
  findDollarFormRows,
  findDuplicateKeys,
  getFunctionNameFromValue,
  legacyValueToNamedCall,
  migrateDollarFormArgs,
  summarizeInstanceDrift,
} from '../../../helpers/custom-function-schema';
import { getRequestDefinitions } from '../../../helpers/request-schema';
import { useT } from '../../../theming/i18n';
import { Button, Tooltip, Typography } from '../../primitives';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { type FunctionInstance, InstanceEditor } from './instance-editor';

export type TabCustomFunctionProps = {
  id: string;
  user?: string;
  customFunctions?: any;
};

export const CustomFunctionTable: React.FC<TabCustomFunctionProps> = ({ id, user, customFunctions }) => {
  const graphActions = useDecisionGraphActions();
  const { disabled, content, inputContent, instanceOutputs } = useDecisionGraphState(
    ({ simulate, disabled, decisionGraph }) => ({
      disabled,
      content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content,
      // 引用模式数据源：首个输入节点的 InputContract/Schema 字段树（typed-input 规格 §2.4）
      inputContent: (decisionGraph?.nodes ?? []).find((node) => node?.type === 'inputNode')?.content,
      // 运行时仿真：上次运行的实例级返回值（trace.output 按 key 归集，passThrough
      // 输入混在里面——按实例 key 取值即纯净结果；表达式节点 traceData 同款读法）
      instanceOutputs: match(simulate)
        .with({ result: P.nonNullable }, ({ result }) => {
          const output = (result.trace as Record<string, { output?: Record<string, unknown> }> | undefined)?.[id]
            ?.output;
          return output && typeof output === 'object' ? (output as Record<string, unknown>) : undefined;
        })
        .otherwise(() => undefined),
    }),
  );

  const functionScope = useMemo(
    () => resolveFunctionScope((content as { kind?: string } | undefined)?.kind, customFunctions),
    [content?.kind, customFunctions],
  );

  const t = useT();
  const expressions = (content?.config as { expressions?: any } | undefined)?.expressions;
  const argsDrift = useMemo(() => computeFunctionArgsDrift(expressions, functionScope), [expressions, functionScope]);
  const driftRowCount = argsDrift.length;
  const driftMissingCount = argsDrift.reduce((sum, entry) => sum + entry.missing.length, 0);
  const driftUnrecognizedCount = argsDrift.reduce((sum, entry) => sum + entry.unrecognized.length, 0);
  // ADR-015 #3 检查单 MUST：kwargs 键撞车 = 0.14+ 双读按信封解释的歧义触发形态
  const kwargsCollisionCount = argsDrift.filter((entry) => entry.kwargsKeyCollision).length;
  const danglingRefCount = argsDrift.reduce((sum, entry) => sum + (entry.danglingRefs?.length ?? 0), 0);

  // ADR-015 增补 P1：实例概览数据（并行集合观 + 键重复 + 实例级漂移）
  const duplicateKeys = useMemo(() => findDuplicateKeys(expressions), [expressions]);
  const instanceViews = useMemo(() => buildInstanceViews(expressions, functionScope), [expressions, functionScope]);
  const driftByRowId = useMemo(() => summarizeInstanceDrift(argsDrift), [argsDrift]);
  // 引用模式字段路径：输入节点 InputContract/Schema 字段树 → 点路径清单（嵌套 a.b 原样）
  const fieldPaths = useMemo(() => getRequestDefinitions(inputContent as never).map((def) => def.path), [inputContent]);
  // $-路径形态实参（OQ7 随档动作②）：kwargs 域 dollar 不接通——恒 null，检测 + 一键迁移
  const dollarRows = useMemo(() => findDollarFormRows(expressions), [expressions]);
  const dollarParamCount = useMemo(() => dollarRows.reduce((sum, row) => sum + row.params.length, 0), [dollarRows]);
  // 实例依赖调度（ADR-015 增补）：Kahn 分层 → 列表层徽标 + 环警告带
  const schedule = useMemo(() => computeInstanceSchedule(expressions), [expressions]);

  // ADR-015 #3：写路径归一为规范形 {$call, kwargs}（编辑器位置数组经声明序
  // 映射；priorKwargs 并回保非位置额外键）；expr_asts 停写（引擎派生，零风险）
  const persistExpressions = (val: any) => {
    const previousById = new Map(((expressions ?? []) as any[]).map((expr: any) => [expr?.id, expr]));
    const canonical = (val ?? []).map((expr: any) => {
      const functionName = Array.isArray(expr?.value)
        ? expr.value[0]
        : typeof expr?.value?.$call === 'string'
          ? expr.value.$call
          : undefined;
      const funcDef = functionScope.functions.find((func: any) => func?.name === functionName);
      const prior = previousById.get(expr?.id)?.value;
      const priorKwargs = prior && typeof prior === 'object' && !Array.isArray(prior) ? (prior.kwargs ?? null) : null;
      const named = editorValueToNamedCall(expr?.value, funcDef, priorKwargs);
      return named ? { ...expr, value: named } : expr;
    });

    graphActions.updateNode(id, (draft) => {
      draft.content.config.expressions = canonical;

      draft.content.config.meta = {
        user: user ?? '',
        proj: user ?? '',
      };
      return draft;
    });
  };

  // ADR-015 增补 P2：expressions → FunctionInstance[]（InstanceEditor 读态）。
  // 旧格式（;; 字符串/位置数组/裸函数名）经 legacyValueToNamedCall 读时转换——
  // 否则读成 {$call:''}，任何写回都会损毁旧实例（引擎拒收空 $call）
  const instances: FunctionInstance[] = useMemo(
    () =>
      (expressions ?? []).map((expr: any) => {
        const fnName = getFunctionNameFromValue(expr?.value);
        const funcDef = functionScope.functions.find((func: any) => func?.name === fnName);
        const legacy = legacyValueToNamedCall(expr?.value, funcDef);
        return {
          id: expr?.id ?? '',
          key: expr?.key ?? '',
          call:
            legacy ??
            (expr?.value !== null && typeof expr?.value === 'object' && !Array.isArray(expr.value)
              ? expr.value
              : { $call: '', kwargs: {} }),
          ...(expr?.dependsOn ? { dependsOn: expr.dependsOn } : {}),
        };
      }),
    [expressions, functionScope],
  );

  // InstanceEditor onChange → 规范形 expressions（写路径经键主权单漏斗）
  const handleInstancesChange = (newInstances: FunctionInstance[]) => {
    graphActions.updateNode(id, (draft) => {
      draft.content.config.expressions = newInstances.map((inst) => ({
        id: inst.id,
        key: inst.key,
        type: 'function',
        value: inst.call,
        ...(inst.dependsOn ? { dependsOn: inst.dependsOn } : {}),
      }));
      draft.content.config.meta = {
        user: user ?? '',
        proj: user ?? '',
      };
      return draft;
    });
  };

  // ADR-015 增补 P2（Windmill 双模式）：表格 ↔ 代码切换
  const [editMode, setEditMode] = useState<'table' | 'code'>('table');
  const [codeDraft, setCodeDraft] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const switchToCode = () => {
    setCodeDraft(JSON.stringify(expressions ?? [], null, 2));
    setCodeError(null);
    setEditMode('code');
  };

  const applyCode = () => {
    if (codeDraft === null) return;
    try {
      const parsed = JSON.parse(codeDraft);
      if (!Array.isArray(parsed)) {
        setCodeError('Expected an array');
        return;
      }
      setEditMode('table');
      setCodeError(null);
      persistExpressions(parsed);
    } catch {
      setCodeError('Invalid JSON');
    }
  };

  const switchToTable = () => {
    setEditMode('table');
    setCodeDraft(null);
    setCodeError(null);
  };

  return (
    // 根被 dg-wrapper 伸展包裹拉满面板高度；编辑区 flex-1 同吃剩余空间——
    // table/code 内容少时不再塌缩（与主 graph 画布同一高度预算）
    <div className='flex h-full flex-col overflow-hidden' style={{ boxSizing: 'border-box' }}>
      {/* ADR-015 增补 P1：实例概览条——并行集合观 + 键重复 + 实例级漂移点标 */}
      {instanceViews.length > 0 && (
        <div data-testid='instance-overview' className='mx-3 mt-3 rounded-md border border-border bg-card px-3 py-2'>
          <div className='flex items-center justify-between gap-2'>
            <Typography.Text strong className='text-xs'>
              {t('cf.instanceOverview')}
            </Typography.Text>
            <Typography.Text className='text-[10px] opacity-60'>{t('cf.parallelHint')}</Typography.Text>
          </div>
          <div className='mt-1.5 flex flex-wrap gap-1.5'>
            {instanceViews.map((view) => {
              const drift = driftByRowId[view.id];
              const isDup = duplicateKeys.includes(view.key);
              return (
                <Tooltip
                  key={`${view.fn}-${view.key}-${view.id}`}
                  title={
                    isDup
                      ? t('cf.duplicateKeyError')
                      : drift
                        ? `${t('cf.argsDriftMissing')} ${drift.missing} · ${t('cf.argsDriftUnrecognized')} ${drift.unrecognized}`
                        : undefined
                  }
                >
                  <span
                    data-testid='instance-chip'
                    data-key={view.key}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                      isDup
                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : drift
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'border-border bg-muted/40'
                    }`}
                  >
                    <span className='font-medium'>{view.fn}</span>
                    {view.seq > 1 && <span className='opacity-50'>#{view.seq}</span>}
                    <span className='opacity-50'>→ {view.key}</span>
                    {isDup && <span aria-label={t('cf.duplicateKeyError')}>⚠</span>}
                    {drift && !isDup && <span className='inline-block size-1.5 rounded-full bg-amber-500' />}
                  </span>
                </Tooltip>
              );
            })}
          </div>
          {duplicateKeys.length > 0 && (
            <div className='mt-1.5 text-xs text-destructive'>
              {t('cf.duplicateKeyError')}: {duplicateKeys.join(', ')}
            </div>
          )}
        </div>
      )}
      {/* Windmill 双模式：表格 ↔ 代码切换 */}
      <div className='mx-3 mt-3 flex items-center justify-between gap-2'>
        <div className='flex items-center gap-1'>
          <Button
            size='small'
            type={editMode === 'table' ? 'primary' : 'default'}
            className='!px-2'
            onClick={() => switchToTable()}
          >
            {t('cf.modeTable')}
          </Button>
          <Button
            size='small'
            type={editMode === 'code' ? 'primary' : 'default'}
            className='!px-2'
            onClick={switchToCode}
          >
            {t('cf.modeCode')}
          </Button>
        </div>
      </div>
      {editMode === 'code' && (
        <div className='mx-3 mt-2 flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-md border border-border'>
          <textarea
            data-testid='function-code-editor'
            className='min-h-0 flex-1 resize-none bg-[var(--card)] p-3 font-mono text-xs text-foreground'
            value={codeDraft ?? JSON.stringify(expressions ?? [], null, 2)}
            onChange={(e) => setCodeDraft(e.target.value)}
            onBlur={applyCode}
            disabled={disabled}
            spellCheck={false}
          />
          {codeError && (
            <div className='border-t border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive'>
              {codeError}
            </div>
          )}
        </div>
      )}
      {editMode === 'table' && (
        <>
          {dollarRows.length > 0 && (
            <Alert variant='warning' data-testid='dollar-form-band' className='mx-3 mt-3 gap-x-2 px-3 py-1.5 text-xs'>
              <WarningOutlined />
              <AlertTitle className='font-normal leading-5'>
                {t('cf.dollarFormBand')} · {dollarRows.length} {t('cf.argsDriftRows')} · {dollarParamCount}{' '}
                {t('cf.argsDriftUnrecognized')}
              </AlertTitle>
              <AlertAction>
                <Button
                  size='small'
                  type='link'
                  className='!px-1'
                  disabled={disabled}
                  data-testid='dollar-form-migrate'
                  onClick={() => {
                    const migrated = migrateDollarFormArgs(expressions, dollarRows);
                    if (migrated) {
                      persistExpressions(migrated);
                    }
                  }}
                >
                  {t('cf.dollarFormMigrate')}
                </Button>
              </AlertAction>
            </Alert>
          )}
          {driftRowCount > 0 && (
            <Alert variant='warning' data-testid='args-drift-band' className='mx-3 mt-3 gap-x-2 px-3 py-1.5 text-xs'>
              <WarningOutlined />
              <AlertTitle className='font-normal leading-5'>
                {t('cf.argsDriftTitle')} · {driftRowCount} {t('cf.argsDriftRows')} · {t('cf.argsDriftMissing')}{' '}
                {driftMissingCount} · {t('cf.argsDriftUnrecognized')} {driftUnrecognizedCount}
                {kwargsCollisionCount > 0 && (
                  <>
                    {' '}
                    · {t('cf.argsKwargsCollision')} {kwargsCollisionCount}
                  </>
                )}
                {danglingRefCount > 0 && (
                  <>
                    {' '}
                    · {t('cf.argsDanglingRefs')} {danglingRefCount}
                  </>
                )}
              </AlertTitle>
              {driftMissingCount > 0 && (
                <AlertAction>
                  <Button
                    size='small'
                    type='link'
                    className='!px-1'
                    disabled={disabled}
                    onClick={() => {
                      const healed = fillMissingFunctionArgs(expressions, argsDrift, functionScope);
                      if (healed) {
                        persistExpressions(healed);
                      }
                    }}
                  >
                    {t('cf.argsFillMissing')}
                  </Button>
                </AlertAction>
              )}
            </Alert>
          )}
          <div className='flex min-h-0 flex-1 flex-col' style={{ paddingTop: driftRowCount > 0 ? 8 : 0 }}>
            <InstanceEditor
              instances={instances}
              functionScope={functionScope}
              disabled={disabled}
              fieldPaths={fieldPaths}
              driftByInstance={driftByRowId}
              duplicateKeys={duplicateKeys}
              outputsByKey={instanceOutputs}
              schedule={schedule}
              onChange={handleInstancesChange}
            />
          </div>
        </>
      )}
    </div>
  );
};
