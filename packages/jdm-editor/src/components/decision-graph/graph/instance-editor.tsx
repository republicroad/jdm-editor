import { PlusSquareOutlined, UnorderedListOutlined } from '#icons';
import { Alert, AlertTitle } from '#reui/alert';
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from '#reui/empty';
import React, { useMemo, useState } from 'react';

import type { FunctionScope, InstanceSchedule } from '../../../helpers/custom-function-schema';
import { computeInstanceDependencyDrift } from '../../../helpers/custom-function-schema';
import { useT } from '../../../theming/i18n';
import { Button, Input, Select, Tag, Tooltip, Typography } from '../../primitives';
import { TypedInput, coerceToTypedValue } from './typed-input';
import type { TypedValue } from './typed-input';

/** 函数实例（规范形一行） */
export type FunctionInstance = {
  id: string;
  /** 输出绑定键 */
  key: string;
  /** 规范形调用 {$call, kwargs} */
  call: { $call: string; kwargs: Record<string, unknown> };
  /** ADR-015 增补：显式依赖声明（additive 预留） */
  dependsOn?: string[];
};

export type InstanceDriftSummary = { missing: number; unrecognized: number };

/** 实例返回值预览：截断单行 + 完整 JSON tooltip（error 形态红显） */
export const resultPreview = (value: unknown, max = 42): string => {
  let text: string;
  try {
    text = typeof value === 'string' ? value : (JSON.stringify(value) ?? 'null');
  } catch {
    text = String(value);
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

export const isErrorResult = (value: unknown): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && 'error' in (value as Record<string, unknown>);

type InstanceEditorProps = {
  instances: FunctionInstance[];
  functionScope: FunctionScope;
  disabled?: boolean;
  /** 引用模式字段路径（输入节点 InputContract 字段树投影；空 = 引用模式隐藏） */
  fieldPaths?: string[];
  /** 实例级参数漂移（行 id → 缺参/未识别计数），供列表点标 */
  driftByInstance?: Record<string, InstanceDriftSummary>;
  /** 重复输出键清单（并行归集覆盖警告） */
  duplicateKeys?: string[];
  /** 上次仿真的实例返回值（key → value；trace.output 投影，run-scoped） */
  outputsByKey?: Record<string, unknown>;
  /** 实例依赖调度结果（Kahn 分层；tab 由 computeInstanceSchedule 计算） */
  schedule?: InstanceSchedule;
  onChange: (instances: FunctionInstance[]) => void;
};

/** 主从编辑器：左栏实例列表 + 右侧单实例编辑器（TypedInput 三模式）。
 *  自管理 selectedId（内部 useState），不需外部 selectedId prop。 */
export const InstanceEditor: React.FC<InstanceEditorProps> = ({
  instances,
  functionScope,
  disabled,
  fieldPaths,
  driftByInstance,
  duplicateKeys,
  outputsByKey,
  schedule,
  onChange,
}) => {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const functions = functionScope.functions;
  const selected = useMemo(
    () => instances.find((inst) => inst.id === selectedId) ?? instances[0] ?? null,
    [instances, selectedId],
  );

  const fnOptions = useMemo(
    () => functions.map((f: any) => ({ value: f.name as string, label: f.name as string })),
    [functions],
  );

  const updateInstance = (id: string, patch: Partial<FunctionInstance>) => {
    onChange(instances.map((inst) => (inst.id === id ? { ...inst, ...patch } : inst)));
  };

  const addInstance = () => {
    const fn = functions[0]?.name ?? '';
    const id = crypto.randomUUID();
    const next = [...instances, { id, key: `output_${instances.length + 1}`, call: { $call: fn, kwargs: {} } }];
    onChange(next);
    setSelectedId(id);
  };

  const removeInstance = (id: string) => {
    const next = instances.filter((inst) => inst.id !== id);
    onChange(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null);
    }
  };

  const selectedFn = selected ? functions.find((f: any) => f.name === selected.call.$call) : undefined;
  // 孤儿容器降级（可见集放大 = UX 供给非安全围栏，授权在服务端 registry）
  const orphanKind = functionScope.orphanKind;
  // 函数缺失态：$call 未登记（作用域为空或名称失配）——右栏仍须渲染可编辑控件，
  // 否则新增实例后右侧一片空白（作用域空时 addInstance 只能落 $call: ''）
  const selectedFnMissing = !!selected && !selectedFn;
  // 未登记的 $call 以合成选项回显在下拉里（可读原名而非空选择）
  const fnDisplayOptions = useMemo(() => {
    if (!selected || !selected.call.$call || fnOptions.some((option) => option.value === selected.call.$call)) {
      return fnOptions;
    }
    return [{ value: selected.call.$call, label: selected.call.$call }, ...fnOptions];
  }, [fnOptions, selected]);
  const paramNames = useMemo(
    () => (selectedFn ? Object.keys(selectedFn.parameters?.properties ?? {}) : []),
    [selectedFn],
  );
  const requiredParams = useMemo(
    () => new Set((selectedFn?.parameters?.required as string[] | undefined) ?? []),
    [selectedFn],
  );
  const selectedDrift = selected ? driftByInstance?.[selected.id] : undefined;
  const selectedIsDup = selected ? (duplicateKeys?.includes(selected.key) ?? false) : false;

  // 依赖声明漂移（ADR-015 增补 UI 面）：悬空 dependsOn（error）/ 声明未引用（info）。
  // 环与分层由 computeInstanceSchedule 覆盖（左栏警示带），此处不重复。
  const dependencyDrift = useMemo(() => computeInstanceDependencyDrift(instances), [instances]);
  const selectedDangling = useMemo(
    () => (selected ? dependencyDrift.danglingDependsOn.filter((d) => d.instanceId === selected.id) : []),
    [dependencyDrift, selected],
  );
  const selectedUnused = useMemo(
    () => (selected ? dependencyDrift.declaredUnused.filter((d) => d.instanceId === selected.id) : []),
    [dependencyDrift, selected],
  );
  const dependencyOptions = useMemo(() => {
    if (!selected) return [];
    const declared = new Set(selected.dependsOn ?? []);
    return instances
      .filter((inst) => inst.id !== selected.id && inst.key && !declared.has(inst.key))
      .map((inst) => ({ value: inst.key, label: inst.key }));
  }, [instances, selected]);

  // 引用源（C2）：兄弟实例键 → `$.<key>`；上次仿真输出为对象时展开一级字段 → `$.<key>.<field>`。
  // 点击复制，宿主粘贴进 args 表达式即建隐式依赖边（ADR-015 增补）。
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const copyRef = (ref: string) => {
    void navigator.clipboard?.writeText(ref).catch(() => {});
    setCopiedRef(ref);
    window.setTimeout(() => setCopiedRef((cur) => (cur === ref ? null : cur)), 1200);
  };
  const referenceChips = useMemo(() => {
    if (!selected) return [] as { ref: string; hint?: string }[];
    return instances
      .filter((inst) => inst.id !== selected.id && inst.key)
      .flatMap((inst) => {
        const base = { ref: `$.${inst.key}` };
        const output = outputsByKey?.[inst.key];
        if (output !== null && typeof output === 'object' && !Array.isArray(output)) {
          const fields = Object.keys(output as Record<string, unknown>).slice(0, 12);
          return [base, ...fields.map((field) => ({ ref: `$.${inst.key}.${field}`, hint: inst.key }))];
        }
        return [base];
      });
  }, [instances, selected, outputsByKey]);

  // 依赖调度投影（ADR-015 增补）：分层号 → 列表徽标；环 → 左栏警告带。
  // DUPLICATE_OUTPUT 不在此呈现（duplicateKeys 通道已覆盖）；零边快路径不出徽标。
  const scheduleOk = schedule && schedule.ok ? schedule : undefined;
  const hasEdges = scheduleOk?.hasEdges ?? false;
  const layerByKey = useMemo(() => {
    const map: Record<string, number> = {};
    if (scheduleOk?.hasEdges) {
      scheduleOk.layers.forEach((layer, i) => {
        for (const key of layer) map[key] = i + 1;
      });
    }
    return map;
  }, [scheduleOk]);

  return (
    <div className='flex min-h-[320px] flex-1 gap-3 overflow-hidden px-3 pb-3'>
      {/* 左栏：实例列表（卡片 + 双行行项 + 漂移/重复点标 + 悬停删除） */}
      <div className='flex w-56 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card'>
        <div className='flex shrink-0 items-center justify-between border-b border-border px-2.5 py-1.5'>
          <Typography.Text className='text-[11px] font-medium uppercase tracking-wide opacity-60'>
            {t('cf.instanceOverview')} · {instances.length}
          </Typography.Text>
          <Button
            size='small'
            type='link'
            className='!px-1 !py-0'
            disabled={disabled}
            onClick={addInstance}
            aria-label={t('cf.addInstance')}
          >
            + {t('cf.addInstance')}
          </Button>
        </div>
        {schedule && !schedule.ok && schedule.error === 'CYCLE_DETECTED' && (
          <Alert
            variant='destructive'
            data-testid='instance-cycle-error'
            className='shrink-0 gap-x-2 rounded-none border-x-0 border-b-0 border-t px-2.5 py-1.5 text-[11px]'
          >
            <AlertTitle className='font-normal leading-snug'>
              {t('cf.scheduleCycleError', { keys: schedule.keys.join(' → ') })}
            </AlertTitle>
          </Alert>
        )}
        <div className='min-h-0 flex-1 overflow-y-auto p-1.5'>
          {instances.map((inst) => {
            const fn = functions.find((f: any) => f.name === inst.call.$call);
            const drift = driftByInstance?.[inst.id];
            const isDup = duplicateKeys?.includes(inst.key) ?? false;
            const layer = hasEdges ? layerByKey[inst.key] : undefined;
            const instDeps = scheduleOk?.depsByItem[inst.key] ?? [];
            const isSelected = selected?.id === inst.id;
            return (
              <div
                key={inst.id}
                role='button'
                tabIndex={0}
                data-testid='instance-list-item'
                data-id={inst.id}
                aria-selected={isSelected}
                className={`group relative mb-1 cursor-pointer rounded-md border px-2 py-1.5 transition-colors ${
                  isSelected
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-transparent hover:border-border hover:bg-muted/60'
                } ${disabled ? 'cursor-default opacity-60' : ''}`}
                onClick={() => setSelectedId(inst.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(inst.id);
                  }
                }}
              >
                <div className='flex items-center gap-1.5'>
                  <span className='min-w-0 flex-1 truncate text-xs font-medium'>{fn?.name ?? inst.call.$call}</span>
                  {isDup ? (
                    <Tooltip title={t('cf.duplicateKeyError')}>
                      <span
                        data-testid='instance-dup-dot'
                        aria-label={t('cf.duplicateKeyError')}
                        className='inline-block size-1.5 shrink-0 rounded-full bg-destructive'
                      />
                    </Tooltip>
                  ) : drift ? (
                    <Tooltip
                      title={`${t('cf.argsDriftMissing')} ${drift.missing} · ${t('cf.argsDriftUnrecognized')} ${drift.unrecognized}`}
                    >
                      <span
                        data-testid='instance-drift-dot'
                        className='inline-block size-1.5 shrink-0 rounded-full bg-amber-500'
                      />
                    </Tooltip>
                  ) : null}
                </div>
                <div className='mt-0.5 flex items-center gap-1'>
                  <span className='min-w-0 flex-1 truncate text-[10px] opacity-50'>→ {inst.key}</span>
                  {layer !== undefined && (
                    <Tooltip
                      title={
                        instDeps.length > 0
                          ? `${t('cf.instanceLayerHint', { layer })} · ${t('cf.dependsOn')}: ${instDeps.join(', ')}`
                          : t('cf.instanceLayerHint', { layer })
                      }
                    >
                      <span
                        data-testid='instance-layer-badge'
                        className='shrink-0 rounded bg-muted/70 px-1 font-mono text-[10px] opacity-80'
                      >
                        L{layer}
                      </span>
                    </Tooltip>
                  )}
                  {outputsByKey && inst.key in outputsByKey && (
                    <Tooltip title={t('cf.lastRunHint')}>
                      <span
                        data-testid='instance-result-chip'
                        className={`max-w-24 truncate rounded px-1 font-mono text-[10px] ${
                          isErrorResult(outputsByKey[inst.key])
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted/70 text-muted-foreground'
                        }`}
                      >
                        {isErrorResult(outputsByKey[inst.key]) ? '⚠ ' : ''}
                        {resultPreview(outputsByKey[inst.key], 24)}
                      </span>
                    </Tooltip>
                  )}
                  {!disabled && (
                    <button
                      type='button'
                      className='shrink-0 text-[10px] opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 group-hover:opacity-60'
                      aria-label='remove'
                      data-testid='instance-remove'
                      onClick={(e) => {
                        e.stopPropagation();
                        removeInstance(inst.id);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {instances.length === 0 && (
            <Empty className='gap-1 border-0 p-3'>
              <EmptyMedia variant='icon' className='size-7 rounded-md [&_svg:not([class*=size-])]:size-3.5'>
                <UnorderedListOutlined />
              </EmptyMedia>
              <EmptyTitle className='text-xs font-normal opacity-60'>{t('cf.instanceEmpty')}</EmptyTitle>
            </Empty>
          )}
        </div>
      </div>

      {/* 右栏：选中实例的参数绑定编辑器（头部 + 键 + 参数区）。
          selectedFn 缺失（未登记函数/作用域空）仍渲染——函数可重选、键可改 */}
      <div className='min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card'>
        {selected ? (
          <div className='flex flex-col gap-4 p-3.5'>
            {/* 头部：函数选择 + 描述 + 输出键 */}
            <div className='flex flex-col gap-2.5'>
              <div className='grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2'>
                <Typography.Text className='text-xs opacity-70'>{t('cf.function')}</Typography.Text>
                <Select
                  disabled={disabled}
                  value={selected.call.$call || undefined}
                  placeholder={t('cf.function')}
                  onChange={(v: string) => updateInstance(selected.id, { call: { $call: v, kwargs: {} } })}
                  options={fnDisplayOptions}
                />
              </div>
              {selectedFnMissing && (
                <Typography.Text
                  data-testid='instance-fn-missing'
                  className='pl-[122px] text-[11px] text-amber-700 dark:text-amber-400'
                >
                  {functions.length === 0 ? t('cf.noFunctionsInScope') : t('cf.unknownFunction')}
                </Typography.Text>
              )}
              {orphanKind && (
                <Typography.Text
                  data-testid='instance-orphan-hint'
                  className='pl-[122px] text-[11px] text-amber-700 dark:text-amber-400'
                >
                  {t('cf.orphanScopeHint', { kind: orphanKind })}
                </Typography.Text>
              )}
              {selectedFn && typeof selectedFn.description === 'string' && selectedFn.description && (
                <div className='pl-[122px] text-[11px] leading-relaxed opacity-50'>{selectedFn.description}</div>
              )}
              <div className='grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2'>
                <Typography.Text className='text-xs opacity-70'>{t('cf.paramKey')}</Typography.Text>
                <div className='flex flex-col gap-1'>
                  <Input
                    disabled={disabled}
                    data-testid='instance-key-input'
                    value={selected.key}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateInstance(selected.id, { key: e.target.value })
                    }
                  />
                  {selectedIsDup && (
                    <Typography.Text data-testid='instance-key-dup' className='text-[11px] text-destructive'>
                      {t('cf.duplicateKeyError')}
                    </Typography.Text>
                  )}
                </div>
              </div>
              <div className='grid grid-cols-[120px_minmax(0,1fr)] items-start gap-2'>
                <Typography.Text className='pt-1.5 text-xs opacity-70'>{t('cf.dependsOn')}</Typography.Text>
                <div className='flex flex-col gap-1.5'>
                  {(selected.dependsOn?.length ?? 0) > 0 && (
                    <div className='flex flex-wrap gap-1' data-testid='instance-depends-on-tags'>
                      {selected.dependsOn!.map((dep) => {
                        const dangling = selectedDangling.some((d) => d.dep === dep);
                        return (
                          <Tag
                            key={dep}
                            className={`border font-mono text-[10px] ${
                              dangling
                                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                                : 'border-border bg-muted/60'
                            }`}
                          >
                            {dep}
                            {!disabled && (
                              <button
                                type='button'
                                aria-label={t('cf.dependsOnRemove', { dep })}
                                data-testid={`instance-depends-on-remove-${dep}`}
                                className='ml-0.5 opacity-50 hover:opacity-100'
                                onClick={() =>
                                  updateInstance(selected.id, {
                                    dependsOn: selected.dependsOn!.filter((d) => d !== dep),
                                  })
                                }
                              >
                                ×
                              </button>
                            )}
                          </Tag>
                        );
                      })}
                    </div>
                  )}
                  <Select
                    disabled={disabled}
                    value={undefined}
                    placeholder={t('cf.dependsOnAdd')}
                    onChange={(v: string) => {
                      updateInstance(selected.id, { dependsOn: [...(selected.dependsOn ?? []), v] });
                    }}
                    options={dependencyOptions}
                  />
                  {selectedDangling.map((d) => (
                    <Typography.Text
                      key={d.dep}
                      data-testid={`instance-depends-on-dangling-${d.dep}`}
                      className='text-[11px] text-destructive'
                    >
                      {t('cf.dependsOnDangling', { dep: d.dep })}
                    </Typography.Text>
                  ))}
                  {selectedUnused.length > 0 && (
                    <Typography.Text data-testid='instance-depends-on-unused' className='text-[11px] opacity-60'>
                      {t('cf.dependsOnUnused', { deps: selectedUnused.map((d) => d.dep).join(', ') })}
                    </Typography.Text>
                  )}
                </div>
              </div>
            </div>

            {/* 引用源：兄弟实例键（及仿真输出一级字段）→ 点击复制 `$.` 引用，粘贴进 args 即建隐式依赖边 */}
            {referenceChips.length > 0 && (
              <div className='flex flex-col gap-1.5' data-testid='instance-reference-sources'>
                <div className='flex items-baseline justify-between gap-2'>
                  <Typography.Text className='text-xs opacity-70'>{t('cf.referenceSources')}</Typography.Text>
                  <Typography.Text className='text-[10px] opacity-40'>{t('cf.referenceSourcesHint')}</Typography.Text>
                </div>
                <div className='flex flex-wrap gap-1'>
                  {referenceChips.map((chip) => (
                    <button
                      key={chip.ref}
                      type='button'
                      title={t('cf.referenceCopy')}
                      data-testid={`reference-chip-${chip.ref}`}
                      className='cursor-pointer rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted/80'
                      onClick={() => copyRef(chip.ref)}
                    >
                      {chip.ref}
                      {copiedRef === chip.ref && <span className='ml-1 opacity-60'>{t('cf.referenceCopied')}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 返回值：上次仿真的实例结果（run-scoped；error 形态红显） */}
            {outputsByKey && selected.key in outputsByKey && (
              <div className='flex flex-col gap-1.5' data-testid='instance-result-section'>
                <div className='flex items-baseline justify-between gap-2'>
                  <Typography.Text className='text-xs opacity-70'>{t('cf.result')}</Typography.Text>
                  <Typography.Text className='text-[10px] opacity-40'>{t('cf.lastRunHint')}</Typography.Text>
                </div>
                <pre
                  className={`max-h-40 overflow-auto rounded-md border px-2.5 py-2 font-mono text-[11px] leading-relaxed ${
                    isErrorResult(outputsByKey[selected.key])
                      ? 'border-destructive/40 bg-destructive/10 text-destructive'
                      : 'border-border bg-muted/40'
                  }`}
                >
                  {resultPreview(outputsByKey[selected.key], 2000)}
                </pre>
              </div>
            )}

            {/* 参数区：声明序参数行（名称 + 必填星 + 类型标）× TypedInput */}
            {paramNames.length > 0 && (
              <>
                <div className='border-t border-border pt-3'>
                  <Typography.Text className='text-[11px] font-medium uppercase tracking-wide opacity-60'>
                    {t('cf.paramSection')}
                  </Typography.Text>
                </div>
                <div className='flex flex-col gap-2.5'>
                  {paramNames.map((name) => {
                    const paramDef = selectedFn.parameters?.properties?.[name];
                    const paramType = typeof paramDef?.type === 'string' ? paramDef.type : 'string';
                    const typed: TypedValue = coerceToTypedValue(selected.call.kwargs[name]);

                    return (
                      <div key={name} className='grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2'>
                        <div className='flex min-w-0 items-center gap-1'>
                          <Typography.Text className='truncate text-xs opacity-70' ellipsis>
                            {name}
                          </Typography.Text>
                          {requiredParams.has(name) && (
                            <span className='shrink-0 text-destructive' title={t('cf.paramRequired')}>
                              *
                            </span>
                          )}
                          <Tag className='shrink-0 border border-border bg-muted/40 text-[9px] uppercase opacity-60'>
                            {paramType}
                          </Tag>
                        </div>
                        <TypedInput
                          parameterType={paramType}
                          value={typed}
                          disabled={disabled}
                          fieldPaths={fieldPaths}
                          onChange={(tv: TypedValue) =>
                            updateInstance(selected.id, {
                              call: {
                                ...selected.call,
                                kwargs: {
                                  ...selected.call.kwargs,
                                  // 全量形态化（typed-input-spec §2.1 落地，ADR-016 步骤 2）：
                                  // 三模式恒写信封——引擎 1.1.0 原生拆包（literal 原样绑定/
                                  // reference 路径解析），expression 信封由执行边界展开
                                  [name]: tv,
                                },
                              },
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {selectedFn && paramNames.length === 0 && (
              <Typography.Text className='text-xs opacity-50'>{t('cf.noParams')}</Typography.Text>
            )}
            {selectedDrift && (
              <Typography.Text
                data-testid='instance-drift-hint'
                className='text-[11px] text-amber-700 dark:text-amber-400'
              >
                {t('cf.argsDriftTitle')}: {t('cf.argsDriftMissing')} {selectedDrift.missing} ·{' '}
                {t('cf.argsDriftUnrecognized')} {selectedDrift.unrecognized}
              </Typography.Text>
            )}
          </div>
        ) : (
          <Empty className='gap-2 border-0 p-6'>
            <EmptyMedia variant='icon'>
              <PlusSquareOutlined />
            </EmptyMedia>
            <EmptyTitle className='text-sm font-normal opacity-70'>{t('cf.selectInstance')}</EmptyTitle>
            {!disabled && (
              <EmptyContent>
                <Button size='small' type='link' onClick={addInstance}>
                  + {t('cf.addInstance')}
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}
      </div>
    </div>
  );
};
