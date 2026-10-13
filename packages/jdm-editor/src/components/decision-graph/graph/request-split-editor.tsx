import { DeleteOutlined, DownOutlined, FormatPainterOutlined, PlusOutlined, RightOutlined } from '#icons';
import { Editor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { RequestDefinition, RequestDefinitionType, RequestExampleSource } from '../../../helpers/request-schema';
import { type TranslationKey, useT } from '../../../theming/i18n';
import { AutosizeTextArea } from '../../autosize-text-area';
import { Button, Popconfirm, Select, Tooltip, Typography } from '../../primitives';
import { PanelEmpty } from '../../shared/panel-empty';
import { BlurCommitInput } from './blur-commit-input';
import { RequestExampleSummary, type RequestExampleSummaryData } from './request-example-summary';
import type { RequestExampleDriftState } from './use-request-examples-editing';

const TYPE_BADGE_CLASS: Record<RequestDefinitionType, string> = {
  string: 'text-sky-600 dark:text-sky-400',
  number: 'text-violet-600 dark:text-violet-400',
  boolean: 'text-amber-600 dark:text-amber-400',
  datetime: 'text-teal-600 dark:text-teal-400',
  array: 'text-fuchsia-600 dark:text-fuchsia-400',
  object: 'text-emerald-600 dark:text-emerald-400',
};

/** 类型徽标（树与编辑器共用） */
export const FieldTypeBadge: React.FC<{ type: RequestDefinitionType }> = ({ type }) => {
  const t = useT();
  const key: TranslationKey = `request.type${type.charAt(0).toUpperCase()}${type.slice(1)}` as TranslationKey;

  return <span className={`shrink-0 text-[10px] uppercase ${TYPE_BADGE_CLASS[type] ?? ''}`}>{t(key)}</span>;
};

/** 左栏常驻字段树（结构导航）：递归折叠 + 选中高亮；对象字段的子字段缩进展示 */
const FieldTree: React.FC<{
  rootDefinitions: RequestDefinition[];
  childrenMap: Map<string, RequestDefinition[]>;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}> = ({ rootDefinitions, childrenMap, selectedPath, onSelect }) => {
  const [collapsed, setCollapsed] = useState<Record<string, true>>({});
  const t = useT();

  const renderNodes = (nodes: RequestDefinition[], depth: number): React.ReactNode =>
    nodes.map((definition) => {
      const children = childrenMap.get(definition.path) ?? [];
      const isCollapsed = Boolean(collapsed[definition.path]);
      const hasChildren = children.length > 0;

      return (
        <React.Fragment key={definition.id}>
          <div
            role='button'
            tabIndex={0}
            data-testid='field-tree-node'
            data-path={definition.path}
            className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors ${
              selectedPath === definition.path ? 'bg-primary/10' : 'hover:bg-muted/60'
            }`}
            style={{ paddingLeft: 6 + depth * 12 }}
            onClick={() => onSelect(definition.path)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(definition.path);
              }
            }}
          >
            {hasChildren ? (
              <button
                type='button'
                className='flex size-4 shrink-0 items-center justify-center opacity-60'
                aria-label={definition.name}
                onClick={(event) => {
                  event.stopPropagation();
                  setCollapsed((previous) => {
                    const next = { ...previous };
                    if (isCollapsed) {
                      delete next[definition.path];
                    } else {
                      next[definition.path] = true;
                    }
                    return next;
                  });
                }}
              >
                {isCollapsed ? <RightOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
              </button>
            ) : (
              <span className='size-4 shrink-0' />
            )}
            <span className='min-w-0 flex-1 truncate'>{definition.name}</span>
            <FieldTypeBadge type={definition.type} />
          </div>
          {hasChildren && !isCollapsed && renderNodes(children, depth + 1)}
        </React.Fragment>
      );
    });

  if (rootDefinitions.length === 0) {
    return (
      <div className='p-2'>
        <PanelEmpty message={t('request.noDefinitions')} />
      </div>
    );
  }

  return <div className='flex flex-col'>{renderNodes(rootDefinitions, 0)}</div>;
};

/** 右栏上下文编辑器：选中字段的类型驱动表单（控件语义与旧 DefinitionCard 一致） */
const ContextEditor: React.FC<{
  definition: RequestDefinition | null;
  disabled: boolean;
  definitionTypeOptions: Array<{ value: RequestDefinitionType; label: string }>;
  childDefinitions: RequestDefinition[];
  onUpdateName: (index: number, name: string) => void;
  onUpdateType: (index: number, type: RequestDefinitionType) => void;
  onUpdateDefaultValue: (index: number, value: string) => void;
  onUpdateDescription: (index: number, value: string) => void;
  onAddChild: (index: number) => void;
  onRemove: (index: number) => void;
  getDefinitionIndex: (id: string) => number;
}> = ({
  definition,
  disabled,
  definitionTypeOptions,
  childDefinitions,
  onUpdateName,
  onUpdateType,
  onUpdateDefaultValue,
  onUpdateDescription,
  onAddChild,
  onRemove,
  getDefinitionIndex,
}) => {
  const t = useT();

  if (!definition) {
    return (
      <div className='flex min-h-0 flex-1 items-center justify-center p-4'>
        <PanelEmpty message={t('request.selectFieldHint')} />
      </div>
    );
  }

  const index = getDefinitionIndex(definition.id);
  const hasChildren = childDefinitions.length > 0;

  return (
    <div className='min-h-0 flex-1 overflow-y-auto p-3'>
      <div className='flex items-center justify-between gap-2'>
        <Typography.Text strong data-testid='context-editor-path' className='truncate text-xs'>
          {definition.path}
        </Typography.Text>
        <Popconfirm
          title={t('request.deleteFieldConfirm')}
          okText={t('common.delete')}
          cancelText={t('common.cancel')}
          disabled={disabled}
          onConfirm={() => onRemove(index)}
        >
          <Button danger type='text' size='small' disabled={disabled} icon={<DeleteOutlined />} />
        </Popconfirm>
      </div>

      <div className='mt-2 flex flex-col gap-2'>
        <div className='grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2'>
          <Typography.Text className='text-xs opacity-70'>{t('request.key')}</Typography.Text>
          <BlurCommitInput
            disabled={disabled}
            value={definition.name}
            onCommit={(nextValue) => onUpdateName(index, nextValue)}
          />
        </div>
        <div className='grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2'>
          <Typography.Text className='text-xs opacity-70'>{t('request.type')}</Typography.Text>
          <Select
            disabled={disabled}
            options={definitionTypeOptions}
            value={definition.type}
            onChange={(value) => onUpdateType(index, value)}
          />
        </div>
        <div className='grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2'>
          <Typography.Text className='text-xs opacity-70'>{t('request.fieldDefaultValuePlaceholder')}</Typography.Text>
          <BlurCommitInput
            disabled={disabled}
            placeholder={t('request.fieldDefaultValuePlaceholder')}
            value={definition.defaultValue ?? ''}
            onCommit={(nextValue) => onUpdateDefaultValue(index, nextValue)}
          />
        </div>
        <div className='grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2'>
          <Typography.Text className='mt-1.5 text-xs opacity-70'>
            {t('request.fieldDescriptionPlaceholder')}
          </Typography.Text>
          <BlurCommitInput
            disabled={disabled}
            placeholder={t('request.fieldDescriptionPlaceholder')}
            value={definition.description}
            onCommit={(nextValue) => onUpdateDescription(index, nextValue)}
          />
        </div>
      </div>

      {definition.type === 'object' && (
        <div data-testid='object-children' className='mt-3 rounded-lg border border-border p-2'>
          <div className='flex items-center justify-between'>
            <Typography.Text className='text-xs opacity-70'>
              {t('request.objectChildrenHint')}（{hasChildren ? childDefinitions.length : 0}）
            </Typography.Text>
            <Button
              type='link'
              size='small'
              className='!px-1'
              disabled={disabled || !definition.name.trim()}
              icon={<PlusOutlined />}
              onClick={() => onAddChild(index)}
            >
              {t('request.addChildField')}
            </Button>
          </div>
          {hasChildren && (
            <div className='mt-1 flex flex-col'>
              {childDefinitions.map((child) => (
                <div key={child.id} className='flex items-center gap-1.5 py-0.5 text-xs'>
                  <span className='min-w-0 flex-1 truncate'>{child.name}</span>
                  <FieldTypeBadge type={child.type} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {definition.type === 'array' && (
        <div className='mt-3 rounded-lg border border-border p-2 text-xs opacity-70'>{t('request.arrayCodeHint')}</div>
      )}
    </div>
  );
};

/** 右栏底部 Example Preview 条：活动示例可编辑 JSON + 本示例漂移动作内联 */
const ExamplePreviewStrip: React.FC<{
  disabled: boolean;
  activeSource: RequestExampleSource | null;
  activeExampleJsonDraft: string;
  activeDescriptionDraft: string;
  exampleFieldSummary: RequestExampleSummaryData | null;
  driftState?: RequestExampleDriftState;
  onRenameActive: (name: string) => void;
  onDescriptionChange: (value: string) => void;
  onDescriptionCommit: () => void;
  onJsonChange: (value: string) => void;
  onJsonCommit: () => void;
  onFormat: () => void;
  onJsonEditorMount: (instance: editor.IStandaloneCodeEditor) => void;
  onMigrate: (() => void) | undefined;
  onConfirm: (() => void) | undefined;
  getDefinitionTypeLabel: (type: RequestDefinitionType) => string;
  exampleEditorOptions: editor.IStandaloneEditorConstructionOptions;
}> = ({
  disabled,
  activeSource,
  activeExampleJsonDraft,
  activeDescriptionDraft,
  exampleFieldSummary,
  driftState,
  onRenameActive,
  onDescriptionChange,
  onDescriptionCommit,
  onJsonChange,
  onJsonCommit,
  onFormat,
  onJsonEditorMount,
  onMigrate,
  onConfirm,
  getDefinitionTypeLabel,
  exampleEditorOptions,
}) => {
  const t = useT();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const blurDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const drift = driftState?.drift;
  const driftCount = drift ? drift.missing.length + drift.extra.length + drift.conflicts.length : 0;
  const constraintCount = driftState?.constraintIssues.length ?? 0;

  useEffect(
    () => () => {
      blurDisposableRef.current?.dispose();
      blurDisposableRef.current = null;
    },
    [],
  );

  return (
    <div data-testid='example-preview-strip' className='flex shrink-0 flex-col gap-1.5 border-t border-border pt-2'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-1.5'>
          <Typography.Text strong className='shrink-0 text-xs'>
            {t('request.examplePreviewTitle')}
          </Typography.Text>
          {activeSource && (
            <BlurCommitInput
              disabled={disabled}
              value={activeSource.name}
              onCommit={(nextName) => {
                const trimmed = nextName.trim();
                if (trimmed) {
                  onRenameActive(trimmed);
                }
              }}
            />
          )}
        </div>
        <div className='flex items-center gap-1'>
          <Tooltip title={t('common.format')}>
            <Button
              type='text'
              size='small'
              shape='circle'
              disabled={disabled || !activeSource}
              onClick={() => onFormat()}
            >
              <FormatPainterOutlined />
            </Button>
          </Tooltip>
          {driftCount > 0 && drift && (
            <Tooltip
              title={`${t('request.driftMissing')} ${drift.missing.length} · ${t('request.driftExtra')} ${drift.extra.length} · ${t('request.driftConflicts')} ${drift.conflicts.length}`}
            >
              <span className='text-[10px] text-amber-600 dark:text-amber-400'>
                {t('request.driftSchemaChanged')} {driftCount}
              </span>
            </Tooltip>
          )}
          {constraintCount > 0 && (
            <Tooltip title={`${t('request.driftConstraints')} ${constraintCount}`}>
              <span className='text-[10px] text-destructive'>
                {t('request.driftConstraints')} {constraintCount}
              </span>
            </Tooltip>
          )}
          {driftCount > 0 && onMigrate && (
            <Button size='small' type='link' className='!px-1' disabled={disabled} onClick={onMigrate}>
              {t('request.driftMigrate')}
            </Button>
          )}
          {driftState?.schemaChanged && driftCount === 0 && constraintCount === 0 && onConfirm && (
            <Button size='small' type='link' className='!px-1' disabled={disabled} onClick={onConfirm}>
              {t('request.driftConfirmValid')}
            </Button>
          )}
        </div>
      </div>
      <AutosizeTextArea
        className='rounded-md border border-border px-2 py-1 text-xs'
        value={activeDescriptionDraft}
        onChange={(event) => onDescriptionChange(event.target.value)}
        onBlur={onDescriptionCommit}
        placeholder={t('request.exampleDescriptionPlaceholder')}
        disabled={disabled || !activeSource}
        maxRows={2}
      />
      <div className='h-[140px] overflow-hidden rounded-md border border-border bg-card'>
        <Editor
          height='100%'
          language='json'
          value={activeExampleJsonDraft}
          onMount={(instance) => {
            editorRef.current = instance;
            blurDisposableRef.current?.dispose();
            blurDisposableRef.current = instance.onDidBlurEditorText(() => onJsonCommit());
            onJsonEditorMount(instance);
          }}
          onChange={(value) => onJsonChange(value ?? '')}
          theme={(exampleEditorOptions as { theme?: string })?.theme ?? 'light'}
          options={{
            ...exampleEditorOptions,
            readOnly: disabled || !activeSource,
          }}
        />
      </div>
      <RequestExampleSummary summary={exampleFieldSummary} getDefinitionTypeLabel={getDefinitionTypeLabel} />
    </div>
  );
};

export type SplitEditorProps = {
  disabled: boolean;
  rootDefinitions: RequestDefinition[];
  childrenMap: Map<string, RequestDefinition[]>;
  definitionTypeOptions: Array<{ value: RequestDefinitionType; label: string }>;
  selectedPath: string | null;
  onSelectField: (path: string | null) => void;
  onAddField: () => void;
  onAddChild: (index: number) => void;
  onUpdateName: (index: number, name: string) => void;
  onUpdateType: (index: number, type: RequestDefinitionType) => void;
  onUpdateDefaultValue: (index: number, value: string) => void;
  onUpdateDescription: (index: number, value: string) => void;
  onRemoveField: (index: number) => void;
  getDefinitionIndex: (id: string) => number;
  exampleSources: RequestExampleSource[];
  activeExampleJsonDraft: string;
  activeDescriptionDraft: string;
  exampleFieldSummary: RequestExampleSummaryData | null;
  driftStates?: Record<string, RequestExampleDriftState>;
  onDescriptionChange: (value: string) => void;
  onDescriptionCommit: () => void;
  onExampleJsonChange: (value: string) => void;
  onExampleJsonCommit: () => void;
  onFormatExample: () => void;
  onExampleJsonEditorMount: (instance: editor.IStandaloneCodeEditor) => void;
  onMigrateActive: () => void;
  onConfirmActive: () => void;
  /** 活动示例改名（Examples 下拉管理入口的补充） */
  onRenameActive: (name: string) => void;
  getDefinitionTypeLabel: (type: RequestDefinitionType) => string;
  exampleEditorOptions: editor.IStandaloneEditorConstructionOptions;
  /** 活动示例索引（Examples 下拉所切换） */
  activeExampleIndex: number;
};

/** 分屏体（Design 模式）：左栏字段树 + 右栏上下文编辑器 + 底部 Example Preview 条 */
export const SplitEditor: React.FC<SplitEditorProps> = (props) => {
  const t = useT();
  // 选中查找走全量定义（子字段不在 rootDefinitions 里——story 抓出的真 bug）
  const allDefinitions = useMemo(() => {
    const all = [...props.rootDefinitions];
    props.childrenMap.forEach((children) => all.push(...children));
    return all;
  }, [props.childrenMap, props.rootDefinitions]);
  const selectedDefinition = useMemo(
    () => allDefinitions.find((definition) => definition.path === props.selectedPath) ?? null,
    [allDefinitions, props.selectedPath],
  );
  const childDefinitions = useMemo(
    () => (selectedDefinition ? (props.childrenMap.get(selectedDefinition.path) ?? []) : []),
    [props.childrenMap, selectedDefinition],
  );
  const activeDriftState = props.driftStates?.[props.exampleSources[props.activeExampleIndex ?? 0]?.id ?? ''];

  return (
    <div className='flex min-h-0 flex-1 gap-3 overflow-hidden'>
      <div className='flex w-56 shrink-0 flex-col overflow-hidden rounded-lg border border-border'>
        <div className='min-h-0 flex-1 overflow-y-auto py-1'>
          <FieldTree
            rootDefinitions={props.rootDefinitions}
            childrenMap={props.childrenMap}
            selectedPath={props.selectedPath}
            onSelect={props.onSelectField}
          />
        </div>
        <div className='shrink-0 border-t border-border p-1.5'>
          <Button
            type='link'
            size='small'
            className='!pl-1'
            disabled={props.disabled}
            icon={<PlusOutlined />}
            onClick={props.onAddField}
          >
            {t('request.addField')}
          </Button>
        </div>
      </div>
      <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
        <ContextEditor
          definition={selectedDefinition}
          disabled={props.disabled}
          definitionTypeOptions={props.definitionTypeOptions}
          childDefinitions={childDefinitions}
          onUpdateName={props.onUpdateName}
          onUpdateType={props.onUpdateType}
          onUpdateDefaultValue={props.onUpdateDefaultValue}
          onUpdateDescription={props.onUpdateDescription}
          onAddChild={props.onAddChild}
          onRemove={props.onRemoveField}
          getDefinitionIndex={props.getDefinitionIndex}
        />
        <ExamplePreviewStrip
          disabled={props.disabled}
          activeSource={props.exampleSources[props.activeExampleIndex ?? 0] ?? null}
          activeExampleJsonDraft={props.activeExampleJsonDraft}
          activeDescriptionDraft={props.activeDescriptionDraft}
          exampleFieldSummary={props.exampleFieldSummary}
          driftState={activeDriftState}
          onDescriptionChange={props.onDescriptionChange}
          onDescriptionCommit={props.onDescriptionCommit}
          onJsonChange={props.onExampleJsonChange}
          onJsonCommit={props.onExampleJsonCommit}
          onFormat={props.onFormatExample}
          onJsonEditorMount={props.onExampleJsonEditorMount}
          onMigrate={props.onMigrateActive}
          onConfirm={props.onConfirmActive}
          onRenameActive={props.onRenameActive}
          getDefinitionTypeLabel={props.getDefinitionTypeLabel}
          exampleEditorOptions={props.exampleEditorOptions}
        />
      </div>
    </div>
  );
};
