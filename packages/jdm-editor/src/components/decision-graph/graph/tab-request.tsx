import { CloudDownloadOutlined, CloudUploadOutlined, DeleteOutlined, DownOutlined, FormatPainterOutlined, ImportOutlined, InfoCircleOutlined, PlusCircleOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { Editor } from '@monaco-editor/react';
import {
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Select,
  Space,
  Tabs,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { DragDropManager } from 'dnd-core';
import json5 from 'json5';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';

import '../../../helpers/monaco';
import { saveFile } from '../../../helpers/file-helpers';
import {
  buildRequestExampleTemplateFromDefinitions,
  formatRequestExampleSourceName,
  normalizeRequestDefinitionOrders,
  buildRequestSchemaFromDefinitions,
  getRequestDefinitions,
  getRequestExampleSources,
  getRequestSchemaSourceValue,
  normalizeRequestFieldKey,
  normalizeRequestExampleDataByDefinitions,
  parseRequestSchemaValue,
  resolveRequestSchemaValue,
  setRequestSchemaValue,
  stringifyRequestSchemaValue,
  type RequestDefinition,
  type RequestDefinitionType,
  type RequestExampleSource,
} from '../../../helpers/request-schema';
import { updateRequestSchemaExamples } from '../../../helpers/request-schema';
import { useTranslation } from '../../../locales';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { JsonToJsonSchemaDialog } from './json-to-json-schema-dialog';
import './tab-request.scss';

export type TabRequestProps = {
  id: string;
  manager?: DragDropManager;
  menuList?: any[];
  type?: string;
};

enum RequestTabKey {
  Definitions = 'definitions',
  Examples = 'examples',
  Schema = 'schema',
}

type ExampleValueType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
const definitionRootKey = '__root__';
const exampleRootKey = '__example_root__';

type ExampleItemDraft = {
  id: string;
  path: string;
  name: string;
  value: unknown;
  depth: number;
  parentPath: string | null;
};

const schemaEditorOptions: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  contextmenu: false,
  fontSize: 13,
  fontFamily: 'var(--mono-font-family)',
  tabSize: 2,
  minimap: { enabled: false },
  overviewRulerBorder: false,
  scrollbar: {
    verticalSliderSize: 4,
    verticalScrollbarSize: 4,
    horizontalScrollbarSize: 4,
    horizontalSliderSize: 4,
  },
};

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const buildDefinitionPath = (parentPath: string | null | undefined, name: string) => (parentPath ? `${parentPath}.${name}` : name);

const buildDefinitionDraftPath = (parentPath: string | null | undefined, id: string) =>
  parentPath ? `${parentPath}.__draft_${id}` : `__draft_${id}`;

const createDefinitionDraft = (parentPath?: string | null, depth = 0, name = ''): RequestDefinition => {
  const id = crypto.randomUUID();
  const trimmedName = name.trim();

  return {
    id,
    path: trimmedName ? buildDefinitionPath(parentPath, trimmedName) : buildDefinitionDraftPath(parentPath, id),
    name,
    type: 'string',
    description: '',
    format: '',
    order: 0,
    depth,
    parentPath: parentPath ?? null,
    source: 'schema.properties',
  };
};

const createRequestDefinitionSyncSignature = (
  definitions: Array<
    Pick<RequestDefinition, 'path' | 'name' | 'type' | 'description' | 'format' | 'parentPath' | 'depth'>
  >,
) =>
  JSON.stringify(
    definitions
      .filter((definition) => definition.name.trim())
      .map((definition) => ({
        path: definition.path,
        name: definition.name,
        type: definition.type,
        description: definition.description,
        format: definition.format,
        parentPath: definition.parentPath,
        depth: definition.depth,
      })),
  );

const mergePersistedDefinitionsWithLocalDraftOrder = (
  previousDefinitions: RequestDefinition[],
  persistedDefinitions: RequestDefinition[],
) => {
  const persistedByPath = new Map(persistedDefinitions.map((definition) => [definition.path, definition]));
  const availablePaths = new Set(persistedDefinitions.map((definition) => definition.path));
  const mergedDefinitions: RequestDefinition[] = [];

  previousDefinitions.forEach((definition) => {
    if (!definition.name.trim()) {
      if (definition.parentPath === null || availablePaths.has(definition.parentPath)) {
        mergedDefinitions.push(definition);
      }

      return;
    }

    const persistedDefinition = persistedByPath.get(definition.path);
    if (!persistedDefinition) {
      return;
    }

    persistedByPath.delete(definition.path);
    mergedDefinitions.push({
      ...persistedDefinition,
      id: definition.id,
    });
  });

  mergedDefinitions.push(...persistedByPath.values());
  return mergedDefinitions;
};

const getExampleValueType = (value: unknown): ExampleValueType => {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
};

const getDefaultValueByType = (type: ExampleValueType): unknown => {
  switch (type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'object':
      return {};
    case 'array':
      return [];
    case 'null':
      return null;
    default:
      return '';
  }
};

const formatJsonDraft = (value: unknown) => {
  if (value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
};

const createExampleItemDraft = (parentPath?: string | null, depth = 0, name = '', value: unknown = ''): ExampleItemDraft => {
  const id = crypto.randomUUID();
  const trimmedName = name.trim();

  return {
    id,
    path: trimmedName ? buildDefinitionPath(parentPath, trimmedName) : buildDefinitionDraftPath(parentPath, id),
    name,
    value,
    depth,
    parentPath: parentPath ?? null,
  };
};

const flattenExampleData = (
  data: Record<string, unknown>,
  parentPath = '',
  depth = 0,
): ExampleItemDraft[] =>
  Object.entries(data).flatMap(([key, value]) => {
    const fieldPath = buildDefinitionPath(parentPath, key);
    const currentItem: ExampleItemDraft = {
      id: `example-item-${fieldPath}`,
      path: fieldPath,
      name: key,
      value,
      depth,
      parentPath: parentPath || null,
    };

    if (isRecord(value)) {
      return [currentItem, ...flattenExampleData(value, fieldPath, depth + 1)];
    }

    return [currentItem];
  });

const setExamplePathValue = (source: Record<string, unknown>, path: string, value: unknown) => {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return;
  }

  let cursor: Record<string, unknown> = source;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }

    if (!isRecord(cursor[segment])) {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as Record<string, unknown>;
  });
};

const buildExampleDataFromDrafts = (items: ExampleItemDraft[]) =>
  items.reduce<Record<string, unknown>>((acc, item) => {
    const nextKey = item.name.trim() ? item.path.trim() : '';
    if (!nextKey) {
      return acc;
    }

    setExamplePathValue(acc, nextKey, item.value);
    return acc;
  }, {});

type JsonValueEditorProps = {
  disabled?: boolean;
  mode: 'object' | 'array';
  value: unknown;
  onChange: (value: unknown) => void;
};

type BlurCommitInputProps = {
  disabled?: boolean;
  placeholder?: string;
  value: string;
  onCommit: (value: string) => void;
};

const BlurCommitInput: React.FC<BlurCommitInputProps> = ({ disabled, placeholder, value, onCommit }) => {
  const [draft, setDraft] = useState(value);
  const lastCommittedValueRef = useRef(value);
  const blurCommitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(value);
    lastCommittedValueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      if (blurCommitTimerRef.current !== null) {
        window.clearTimeout(blurCommitTimerRef.current);
      }
    };
  }, []);

  const commitDraft = () => {
    if (draft === lastCommittedValueRef.current) {
      return;
    }

    lastCommittedValueRef.current = draft;
    onCommit(draft);
  };

  const scheduleCommitDraft = () => {
    if (blurCommitTimerRef.current !== null) {
      window.clearTimeout(blurCommitTimerRef.current);
    }

    blurCommitTimerRef.current = window.setTimeout(() => {
      blurCommitTimerRef.current = null;
      commitDraft();
    }, 0);
  };

  const cancelScheduledCommit = () => {
    if (blurCommitTimerRef.current === null) {
      return;
    }

    window.clearTimeout(blurCommitTimerRef.current);
    blurCommitTimerRef.current = null;
  };

  return (
    <Input
      disabled={disabled}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={scheduleCommitDraft}
      onFocus={cancelScheduledCommit}
      onPressEnter={() => {
        cancelScheduledCommit();
        commitDraft();
      }}
    />
  );
};

const JsonValueEditor: React.FC<JsonValueEditorProps> = ({ disabled, mode, value, onChange }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(formatJsonDraft(value));
  const [error, setError] = useState<string>();

  useEffect(() => {
    setDraft(formatJsonDraft(value));
    setError(undefined);
  }, [value]);

  const applyDraft = () => {
    try {
      const fallback = mode === 'array' ? '[]' : '{}';
      const parsed = json5.parse((draft || fallback).trim() || fallback);
      const isValid = mode === 'array' ? Array.isArray(parsed) : isRecord(parsed);

      if (!isValid) {
        setError(mode === 'array' ? t('requestJsonArrayError') : t('requestJsonObjectError'));
        return;
      }

      setError(undefined);
      setDraft(JSON.stringify(parsed, null, 2));
      onChange(parsed);
    } catch {
      setError(t('requestJsonInvalidError'));
    }
  };

  return (
    <div className='grl-request-tab__json-editor'>
      <Input.TextArea
        disabled={disabled}
        rows={3}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (error) {
            setError(undefined);
          }
        }}
        onBlur={applyDraft}
      />
      {error && (
        <Typography.Text type='danger' className='grl-request-tab__json-editor__error'>
          {error}
        </Typography.Text>
      )}
    </div>
  );
};

type ExampleValueEditorProps = {
  disabled?: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
};

const ExampleValueEditor: React.FC<ExampleValueEditorProps> = ({ disabled, value, onChange }) => {
  const valueType = getExampleValueType(value);

  switch (valueType) {
    case 'number':
      return (
        <InputNumber
          disabled={disabled}
          style={{ width: '100%' }}
          value={typeof value === 'number' ? value : undefined}
          onChange={(next) => onChange(typeof next === 'number' ? next : 0)}
        />
      );
    case 'boolean':
      return (
        <Select
          disabled={disabled}
          value={String(Boolean(value))}
          options={[
            { value: 'true', label: 'true' },
            { value: 'false', label: 'false' },
          ]}
          onChange={(next) => onChange(next === 'true')}
        />
      );
    case 'object':
      return <JsonValueEditor disabled={disabled} mode='object' value={value} onChange={onChange} />;
    case 'array':
      return <JsonValueEditor disabled={disabled} mode='array' value={value} onChange={onChange} />;
    case 'null':
      return <Input disabled value='null' />;
    default:
      return (
        <Input
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
};

export const TabRequest: React.FC<TabRequestProps> = ({ id, type }) => {
  const { t } = useTranslation();
  const graphActions = useDecisionGraphActions();
  const { token } = theme.useToken();
  const schemaEditorRef = useRef<editor.IStandaloneCodeEditor>();
  const schemaEditorBlurDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<RequestTabKey>(RequestTabKey.Definitions);
  const [jsonToJsonSchemaOpen, setJsonToJsonSchemaOpen] = useState(false);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [collapsedDefinitionPaths, setCollapsedDefinitionPaths] = useState<Record<string, true>>({});
  const [collapsedExamplePaths, setCollapsedExamplePaths] = useState<Record<string, true>>({});
  const [exampleDraftsBySourceId, setExampleDraftsBySourceId] = useState<Record<string, ExampleItemDraft[]>>({});

  const { disabled, content, nodeName, panels, activePanel, activeGraphTabId, simulatorExampleBinding } = useDecisionGraphState(
    ({ disabled, decisionGraph, panels, activePanel, activeTab, simulatorExampleBinding }) => ({
      disabled,
      content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content,
      nodeName: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.name ?? t('request'),
      panels,
      activePanel,
      activeGraphTabId: activeTab,
      simulatorExampleBinding,
    }),
  );

  const sourceSchemaValue = useMemo(() => getRequestSchemaSourceValue(content), [content?.schema, content?.schemaUI, content?.inputs]);
  const sourceSchemaObject = useMemo(() => parseRequestSchemaValue(sourceSchemaValue), [sourceSchemaValue]);
  const schemaObject = useMemo(
    () => resolveRequestSchemaValue(content, { includeExamples: true }),
    [content?.schema, content?.schemaUI, content?.inputs],
  );
  const schemaText = useMemo(() => stringifyRequestSchemaValue(schemaObject), [schemaObject]);
  const persistedSchemaText = useMemo(() => stringifyRequestSchemaValue(sourceSchemaValue) || schemaText, [sourceSchemaValue, schemaText]);
  const persistedDefinitions = useMemo(() => getRequestDefinitions(content), [content?.schema, content?.schemaUI, content?.inputs]);
  const exampleSources = useMemo(
    () => getRequestExampleSources(content, { dataLabel: t('requestDataLabel') }),
    [content, t],
  );
  const [definitionDrafts, setDefinitionDrafts] = useState<RequestDefinition[]>(persistedDefinitions);
  const [schemaDraft, setSchemaDraft] = useState(persistedSchemaText);
  const [isSchemaDraftDirty, setIsSchemaDraftDirty] = useState(false);
  const schemaDraftRef = useRef(schemaDraft);
  const persistedSchemaTextRef = useRef(persistedSchemaText);
  const pendingExternalSchemaDraftValueRef = useRef<string | null>(null);
  const initializedSchemaSyncNodeIdsRef = useRef<Set<string>>(new Set());
  const persistedDefinitionSignature = useMemo(
    () => createRequestDefinitionSyncSignature(persistedDefinitions),
    [persistedDefinitions],
  );
  const pendingDefinitionSyncSignatureRef = useRef<string | null>(null);
  const contentSchemaRef = useRef(sourceSchemaValue);
  const previousNodeIdRef = useRef(id);
  const pendingSchemaCommitRef = useRef<string | null>(null);

  const applyExternalSchemaDraft = (nextValue: string, options?: { dirty?: boolean }) => {
    pendingExternalSchemaDraftValueRef.current = nextValue;
    schemaDraftRef.current = nextValue;
    setSchemaDraft(nextValue);

    if (options?.dirty !== undefined) {
      setIsSchemaDraftDirty(options.dirty);
    }
  };

  useEffect(() => {
    schemaDraftRef.current = schemaDraft;
  }, [schemaDraft]);

  useEffect(() => {
    persistedSchemaTextRef.current = persistedSchemaText;
  }, [persistedSchemaText]);

  useEffect(() => {
    contentSchemaRef.current = sourceSchemaValue;
  }, [sourceSchemaValue]);

  useEffect(() => {
    if (previousNodeIdRef.current === id) {
      return;
    }

    previousNodeIdRef.current = id;
    pendingSchemaCommitRef.current = null;
    pendingDefinitionSyncSignatureRef.current = null;
    applyExternalSchemaDraft(persistedSchemaText, { dirty: false });
  }, [id, persistedSchemaText]);

  useEffect(() => {
    if (isSchemaDraftDirty) {
      return;
    }

    if (pendingSchemaCommitRef.current !== null) {
      if (persistedSchemaText !== pendingSchemaCommitRef.current) {
        return;
      }

      pendingSchemaCommitRef.current = null;
    }

    if (schemaDraftRef.current === persistedSchemaText) {
      return;
    }

    applyExternalSchemaDraft(persistedSchemaText);
  }, [isSchemaDraftDirty, persistedSchemaText]);

  useEffect(() => {
    return () => {
      schemaEditorBlurDisposableRef.current?.dispose();
      schemaEditorBlurDisposableRef.current = null;
    };
  }, []);

  useEffect(() => {
    setDefinitionDrafts((previousDefinitions) => {
      const isLocalDefinitionSync =
        pendingDefinitionSyncSignatureRef.current !== null &&
        pendingDefinitionSyncSignatureRef.current === persistedDefinitionSignature;
      pendingDefinitionSyncSignatureRef.current = null;

      if (isLocalDefinitionSync) {
        const mergedDefinitions = mergePersistedDefinitionsWithLocalDraftOrder(previousDefinitions, persistedDefinitions);

        return mergedDefinitions;
      }

      const pendingDefinitions = previousDefinitions.filter((definition) => !definition.name.trim());
      if (pendingDefinitions.length === 0) {
        return persistedDefinitions;
      }

      const availablePaths = new Set(persistedDefinitions.map((definition) => definition.path));
      const safePendingDefinitions = pendingDefinitions.filter(
        (definition) => definition.parentPath === null || availablePaths.has(definition.parentPath),
      );

      return [...persistedDefinitions, ...safePendingDefinitions];
    });
  }, [id, persistedDefinitionSignature, persistedDefinitions]);

  const definitionChildrenMap = useMemo(() => {
    const map = new Map<string, RequestDefinition[]>();
    definitionDrafts.forEach((definition) => {
      const key = definition.parentPath ?? definitionRootKey;
      const current = map.get(key) ?? [];
      current.push(definition);
      map.set(key, current);
    });

    return map;
  }, [definitionDrafts]);

  const rootDefinitions = useMemo(() => definitionChildrenMap.get(definitionRootKey) ?? [], [definitionChildrenMap]);

  const isSchemaDefinitionsAuthoritative = Boolean(sourceSchemaObject && hasOwn(sourceSchemaObject, 'properties'));
  const isSchemaExamplesAuthoritative = Boolean(sourceSchemaObject && hasOwn(sourceSchemaObject, 'examples'));
  const definitionTypeOptions = useMemo<Array<{ value: RequestDefinitionType; label: string }>>(
    () => [
      { value: 'string', label: t('requestTypeString') },
      { value: 'number', label: t('requestTypeNumber') },
      { value: 'array', label: t('requestTypeArray') },
      { value: 'object', label: t('requestTypeObject') },
      { value: 'datetime', label: t('requestTypeDatetime') },
      { value: 'boolean', label: t('requestTypeBoolean') },
    ],
    [t],
  );
  const exampleValueTypeOptions = useMemo(
    () => [
      { value: 'string', label: t('requestTypeString') },
      { value: 'number', label: t('requestTypeNumber') },
      { value: 'boolean', label: t('requestTypeBoolean') },
      { value: 'object', label: t('requestTypeObject') },
      { value: 'array', label: t('requestTypeArray') },
      { value: 'null', label: t('requestTypeNull') },
    ],
    [t],
  );
  const getExampleSourceName = (index: number) => formatRequestExampleSourceName(index, t('requestDataLabel'));
  const activeSource = exampleSources[activeSourceIndex] ?? null;
  const normalizeExampleData = (data?: Record<string, unknown>, definitions = definitionDrafts) =>
    normalizeRequestExampleDataByDefinitions(isRecord(data) ? data : {}, definitions);
  const getPreparedExampleData = (data?: Record<string, unknown>) => normalizeExampleData(data);
  const persistedActiveExampleDrafts = useMemo(
    () => flattenExampleData(getPreparedExampleData(activeSource?.data ?? {})),
    [activeSource?.data, activeSource?.id, definitionDrafts],
  );
  const activeExampleDrafts = useMemo(() => {
    if (!activeSource) {
      return [];
    }

    return exampleDraftsBySourceId[activeSource.id] ?? persistedActiveExampleDrafts;
  }, [activeSource, exampleDraftsBySourceId, persistedActiveExampleDrafts]);
  const exampleChildrenMap = useMemo(() => {
    const map = new Map<string, ExampleItemDraft[]>();

    activeExampleDrafts.forEach((item) => {
      const key = item.parentPath ?? exampleRootKey;
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    });

    return map;
  }, [activeExampleDrafts]);
  const rootExampleItems = useMemo(() => exampleChildrenMap.get(exampleRootKey) ?? [], [exampleChildrenMap]);

  useEffect(() => {
    if (activeSourceIndex <= Math.max(exampleSources.length - 1, 0)) {
      return;
    }

    setActiveSourceIndex(Math.max(exampleSources.length - 1, 0));
  }, [activeSourceIndex, exampleSources.length]);

  useEffect(() => {
    if (simulatorExampleBinding?.nodeId !== id) {
      return;
    }

    if (simulatorExampleBinding.sourceIndex < 0 || simulatorExampleBinding.sourceIndex >= exampleSources.length) {
      return;
    }

    if (simulatorExampleBinding.sourceIndex === activeSourceIndex) {
      return;
    }

    setActiveSourceIndex(simulatorExampleBinding.sourceIndex);
  }, [activeSourceIndex, exampleSources.length, id, simulatorExampleBinding]);

  useEffect(() => {
    if (!activeSource) {
      return;
    }

    setExampleDraftsBySourceId((previousDraftsBySourceId) => {
      const previousDrafts = previousDraftsBySourceId[activeSource.id] ?? [];
      const pendingDrafts = previousDrafts.filter((item) => !item.name.trim());
      const availablePaths = new Set(persistedActiveExampleDrafts.map((item) => item.path));
      const safePendingDrafts = pendingDrafts.filter(
        (item) => item.parentPath === null || availablePaths.has(item.parentPath),
      );

      return {
        ...previousDraftsBySourceId,
        [activeSource.id]: [...persistedActiveExampleDrafts, ...safePendingDrafts],
      };
    });
  }, [activeSource, persistedActiveExampleDrafts]);

  useEffect(() => {
    if (activeGraphTabId !== id || !activeSource) {
      return;
    }

    if (
      simulatorExampleBinding?.nodeId === id &&
      simulatorExampleBinding.sourceIndex !== activeSourceIndex &&
      simulatorExampleBinding.sourceIndex >= 0 &&
      simulatorExampleBinding.sourceIndex < exampleSources.length
    ) {
      return;
    }

    const hasMatchedBinding =
      simulatorExampleBinding?.nodeId === id &&
      simulatorExampleBinding.sourceIndex === activeSourceIndex &&
      simulatorExampleBinding.sourceName === activeSource.name;

    if (hasMatchedBinding) {
      return;
    }

    graphActions.setSimulatorExampleBinding({
      nodeId: id,
      sourceIndex: activeSourceIndex,
      sourceName: activeSource.name,
    });
  }, [activeGraphTabId, activeSource, activeSourceIndex, exampleSources.length, graphActions, id, simulatorExampleBinding]);

  const openSimulatorPanel = () => {
    const simulatorPanel = panels?.find((panel) => panel.id === 'simulator');
    if (simulatorPanel) {
      graphActions.setActivePanel(simulatorPanel.id);
    }
  };

  const updateNodeSchema = (nextSchema: string) => {
    graphActions.updateNode(id, (draft) => {
      draft.content ??= {};
      if (type === 'input') {
        setRequestSchemaValue(draft.content as Record<string, any>, nextSchema);
      } else {
        draft.content.schema = nextSchema;
      }
      return draft;
    });
  };

  useEffect(() => {
    if (initializedSchemaSyncNodeIdsRef.current.has(id)) {
      return;
    }

    const hasPersistedSchemaProperties = Boolean(
      sourceSchemaObject &&
      hasOwn(sourceSchemaObject, 'properties') &&
      isRecord(sourceSchemaObject.properties),
    );
    const hasLegacyInputs = (content?.inputs ?? []).length > 0;
    const nextSchemaText = schemaText.trim();

    if (hasPersistedSchemaProperties) {
      initializedSchemaSyncNodeIdsRef.current.add(id);
      return;
    }

    if (!hasLegacyInputs || !nextSchemaText) {
      return;
    }

    initializedSchemaSyncNodeIdsRef.current.add(id);
    pendingSchemaCommitRef.current = nextSchemaText;
    applyExternalSchemaDraft(nextSchemaText, { dirty: false });
    updateNodeSchema(nextSchemaText);

    if (import.meta.env.DEV) {
      console.log('[request-tab] initialized schema from legacy inputs', {
        nodeId: id,
        hasLegacyInputs,
        nextSchemaText,
      });
    }
  }, [content?.inputs, id, schemaText, sourceSchemaObject]);

  const commitSchemaDraft = () => {
    const nextSchemaDraft = schemaDraftRef.current;
    const trimmedSchemaDraft = nextSchemaDraft.trim();

    if (!trimmedSchemaDraft) {
      pendingSchemaCommitRef.current = null;

      if (stringifyRequestSchemaValue(contentSchemaRef.current).trim()) {
        pendingSchemaCommitRef.current = '';
        updateNodeSchema('');
      }

      applyExternalSchemaDraft('', { dirty: false });
      return;
    }

    if (!parseRequestSchemaValue(nextSchemaDraft)) {
      return;
    }

    if (nextSchemaDraft === persistedSchemaTextRef.current) {
      pendingSchemaCommitRef.current = null;
      setIsSchemaDraftDirty(false);
      return;
    }

    pendingSchemaCommitRef.current = nextSchemaDraft;
    updateNodeSchema(nextSchemaDraft);
    setIsSchemaDraftDirty(false);
  };

  const handleSchemaDraftChange = (nextValue: string) => {
    if (
      pendingExternalSchemaDraftValueRef.current !== null &&
      nextValue === pendingExternalSchemaDraftValueRef.current
    ) {
      pendingExternalSchemaDraftValueRef.current = null;
      schemaDraftRef.current = nextValue;
      setSchemaDraft(nextValue);
      return;
    }

    pendingExternalSchemaDraftValueRef.current = null;
    pendingSchemaCommitRef.current = null;
    schemaDraftRef.current = nextValue;
    setSchemaDraft(nextValue);
    setIsSchemaDraftDirty(true);
  };

  const handleConvertToJsonSchemaSuccess = ({ schema, model }: { schema: string; model: string }) => {
    localStorage.setItem(`${id}-request-model`, model);

    const currentSchema = parseRequestSchemaValue(sourceSchemaValue);
    const convertedSchema = parseRequestSchemaValue(schema);
    const nextSchemaObject =
      convertedSchema && currentSchema?.examples
        ? {
            ...convertedSchema,
            examples: currentSchema.examples,
          }
        : convertedSchema;
    const nextSchemaText = nextSchemaObject ? stringifyRequestSchemaValue(nextSchemaObject) : schema;

    pendingSchemaCommitRef.current = nextSchemaText;
    applyExternalSchemaDraft(nextSchemaText, { dirty: false });
    updateNodeSchema(nextSchemaText);
    setJsonToJsonSchemaOpen(false);
  };

  const syncExampleToSimulator = (source?: RequestExampleSource | null, sourceIndex = activeSourceIndex) => {
    if (!source) {
      graphActions.setSimulatorRequest('');
      graphActions.setSimulatorExampleBinding(null);
      return;
    }

    const preparedExampleData = getPreparedExampleData(source.data);
    const nextRequest = JSON.stringify(preparedExampleData, null, 2);
    graphActions.setSimulatorRequest(nextRequest);
    graphActions.setSimulatorExampleBinding({
      nodeId: id,
      sourceIndex,
      sourceName: source.name,
    });

    openSimulatorPanel();
  };

  const persistDefinitions = (nextDefinitions: RequestDefinition[]) => {
    const normalizedDefinitions = normalizeRequestDefinitionOrders(nextDefinitions);
    const hasValidDefinitions = normalizedDefinitions.some(
      (definition) => definition.name.trim() && definition.path.trim(),
    );
    pendingDefinitionSyncSignatureRef.current = createRequestDefinitionSyncSignature(normalizedDefinitions);
    setDefinitionDrafts(normalizedDefinitions);

    if (!hasValidDefinitions) {
      const currentSchema = parseRequestSchemaValue(sourceSchemaValue);
      const nextSchemaObject =
        currentSchema && Array.isArray(currentSchema.examples)
          ? {
              ...currentSchema,
              type: 'object',
              properties: {},
            }
          : null;

      updateNodeSchema(nextSchemaObject ? stringifyRequestSchemaValue(nextSchemaObject) : '');
      return;
    }

    updateNodeSchema(buildRequestSchemaFromDefinitions(sourceSchemaValue, normalizedDefinitions));
  };

  const persistExamples = (
    nextSources: RequestExampleSource[],
    nextActiveIndex = activeSourceIndex,
    options?: {
      syncToSimulator?: boolean;
    },
  ) => {
    const normalizedNextSources = nextSources.map((source) => ({
      ...source,
      data: normalizeExampleData(source.data),
    }));
    const nextSchema = updateRequestSchemaExamples(
      sourceSchemaValue,
      normalizedNextSources.map((source) => source.data),
    );
    updateNodeSchema(nextSchema);

    const safeIndex = Math.max(0, Math.min(nextActiveIndex, normalizedNextSources.length - 1));
    setActiveSourceIndex(safeIndex);
    const shouldSyncToSimulator = options?.syncToSimulator ?? true;

    if (shouldSyncToSimulator) {
      syncExampleToSimulator(normalizedNextSources[safeIndex], safeIndex);
    }
  };

  const getBranchEndIndex = <T extends { path: string }>(items: T[], path: string) => {
    const prefix = `${path}.`;
    let endIndex = items.findIndex((item) => item.path === path);
    if (endIndex < 0) {
      return items.length;
    }

    endIndex += 1;
    while (endIndex < items.length && items[endIndex].path.startsWith(prefix)) {
      endIndex += 1;
    }

    return endIndex;
  };

  const updateDefinitionDescription = (index: number, description: string) => {
    persistDefinitions(
      definitionDrafts.map((definition, currentIndex) =>
        currentIndex === index
          ? {
              ...definition,
              description,
            }
          : definition,
      ),
    );
  };

  const updateDefinitionName = (index: number, name: string) => {
    const target = definitionDrafts[index];
    if (!target) {
      return;
    }

    const normalizedName = normalizeRequestFieldKey(name);
    const hasChildDefinitions = definitionDrafts.some((definition) => definition.parentPath === target.path);
    if (hasChildDefinitions && !normalizedName) {
      return;
    }

    const nextPath = normalizedName
      ? buildDefinitionPath(target.parentPath, normalizedName)
      : buildDefinitionDraftPath(target.parentPath, target.id);
    const nextDefinitions = definitionDrafts.map((definition) => {
      if (definition.path !== target.path && !definition.path.startsWith(`${target.path}.`)) {
        return definition;
      }

      if (definition.path === target.path) {
        return {
          ...definition,
          name: normalizedName,
          path: nextPath,
        };
      }

      const suffix = definition.path.slice(target.path.length);
      const descendantPath = nextPath ? `${nextPath}${suffix}` : suffix.replace(/^\./, '');
      const segments = descendantPath.split('.').filter(Boolean);
      const nextName = definition.name.trim() ? segments[segments.length - 1] ?? definition.name : definition.name;

      return {
        ...definition,
        path: descendantPath,
        name: nextName,
        parentPath: segments.length > 1 ? segments.slice(0, -1).join('.') : null,
        depth: Math.max(segments.length - 1, 0),
      };
    });

    persistDefinitions(nextDefinitions);
  };

  const updateDefinitionType = (index: number, type: RequestDefinitionType) => {
    const target = definitionDrafts[index];
    if (!target) {
      return;
    }

    const nextFormat =
      type === 'datetime'
        ? target.format || 'date-time'
        : type === 'string'
          ? target.type === 'datetime'
            ? ''
            : target.format
          : '';
    const nextDefinitions = definitionDrafts
      .filter((definition, currentIndex) => {
        if (currentIndex === index) {
          return true;
        }

        if (type === 'object') {
          return true;
        }

        return !(definition.path.startsWith(`${target.path}.`));
      })
      .map((definition, currentIndex) =>
        currentIndex === index
          ? {
              ...definition,
              type,
              format: nextFormat,
            }
          : definition,
      );

    persistDefinitions(nextDefinitions);
  };

  const removeDefinition = (index: number) => {
    const target = definitionDrafts[index];
    if (!target) {
      return;
    }

    persistDefinitions(
      definitionDrafts.filter(
        (definition) => definition.path !== target.path && !definition.path.startsWith(`${target.path}.`),
      ),
    );
  };

  const addDefinition = () => {
    persistDefinitions([...definitionDrafts, createDefinitionDraft(null, 0, '')]);
  };

  const addChildDefinition = (index: number) => {
    const parent = definitionDrafts[index];
    if (!parent || parent.type !== 'object' || !parent.path.trim()) {
      return;
    }

    const insertAt = getBranchEndIndex(definitionDrafts, parent.path);
    const nextDefinitions = [...definitionDrafts];
    nextDefinitions.splice(insertAt, 0, createDefinitionDraft(parent.path, parent.depth + 1, ''));
    persistDefinitions(nextDefinitions);
  };

  const toggleDefinitionCollapsed = (path: string) => {
    setCollapsedDefinitionPaths((previousState) => {
      const nextState = { ...previousState };

      if (nextState[path]) {
        delete nextState[path];
      } else {
        nextState[path] = true;
      }

      return nextState;
    });
  };

  const getDefinitionIndex = (definitionId: string) =>
    definitionDrafts.findIndex((definition) => definition.id === definitionId);

  const renderDefinitionCard = (definition: RequestDefinition): React.ReactNode => {
    const definitionIndex = getDefinitionIndex(definition.id);
    if (definitionIndex < 0) {
      return null;
    }

    const childDefinitions = definitionChildrenMap.get(definition.path) ?? [];
    const hasChildDefinitions = childDefinitions.length > 0;
    const canAddChild = definition.type === 'object' || hasChildDefinitions;
    const canToggleChildren = hasChildDefinitions;
    const isCollapsed = Boolean(collapsedDefinitionPaths[definition.path]);

    return (
      <div
        className={`grl-request-tab__definition-card ${
          definition.type === 'object' ? 'grl-request-tab__definition-card--object' : ''
        }`}
        key={definition.id}
      >
        <div className='grl-request-tab__definition-row'>
          <div
            className='grl-request-tab__definition-key'
            style={{ '--definition-depth': definition.depth } as React.CSSProperties}
          >
            <div className='grl-request-tab__definition-key__inner'>
              {definition.depth > 0 && <span className='grl-request-tab__definition-key__guide' aria-hidden />}
              <div className='grl-request-tab__definition-key__content'>
                {canToggleChildren ? (
                  <Button
                    type='text'
                    size='small'
                    disabled={disabled}
                    className='grl-request-tab__definition-toggle'
                    icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
                    onClick={() => toggleDefinitionCollapsed(definition.path)}
                  />
                ) : (
                  <span className='grl-request-tab__definition-toggle-spacer' aria-hidden />
                )}
                <BlurCommitInput
                  disabled={disabled}
                  placeholder={
                    definition.depth > 0 ? t('requestChildFieldNamePlaceholder') : t('requestFieldNamePlaceholder')
                  }
                  value={definition.name}
                  onCommit={(nextValue) => updateDefinitionName(definitionIndex, nextValue)}
                />
              </div>
            </div>
          </div>
          <Select
            disabled={disabled}
            options={definitionTypeOptions}
            value={definition.type}
            onChange={(value) => updateDefinitionType(definitionIndex, value)}
          />
          <BlurCommitInput
            disabled={disabled}
            placeholder={t('requestFieldDescriptionPlaceholder')}
            value={definition.description}
            onCommit={(nextValue) => updateDefinitionDescription(definitionIndex, nextValue)}
          />
          <div className='grl-request-tab__definition-actions'>
            {canAddChild && (
              <Tooltip title={t('requestAddChildField')}>
                <Button
                  type='text'
                  size='small'
                  disabled={disabled || !definition.name.trim()}
                  icon={<PlusOutlined />}
                  onClick={() => addChildDefinition(definitionIndex)}
                />
              </Tooltip>
            )}
            <Popconfirm
              title={t('requestDeleteFieldConfirm')}
              okText={t('delete')}
              cancelText={t('cancel')}
              disabled={disabled}
              onConfirm={() => removeDefinition(definitionIndex)}
            >
              <Button
                danger
                type='text'
                disabled={disabled}
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </div>
        </div>

        {hasChildDefinitions && !isCollapsed && (
          <div className='grl-request-tab__definition-children'>
            {childDefinitions.map((childDefinition) => renderDefinitionCard(childDefinition))}
          </div>
        )}
      </div>
    );
  };

  const persistActiveExampleDrafts = (nextDrafts: ExampleItemDraft[]) => {
    if (!activeSource) {
      return;
    }

    const nextData = buildExampleDataFromDrafts(nextDrafts);
    setExampleDraftsBySourceId((previousDraftsBySourceId) => ({
      ...previousDraftsBySourceId,
      [activeSource.id]: nextDrafts,
    }));

    persistExamples(
      exampleSources.map((source, index) =>
        index === activeSourceIndex
          ? {
              ...source,
              data: nextData,
            }
          : source,
      ),
      activeSourceIndex,
      {
        syncToSimulator: false,
      },
    );
  };

  const toggleExampleCollapsed = (path: string) => {
    if (!activeSource) {
      return;
    }

    const collapseKey = `${activeSource.id}:${path}`;
    setCollapsedExamplePaths((previousState) => {
      const nextState = { ...previousState };

      if (nextState[collapseKey]) {
        delete nextState[collapseKey];
      } else {
        nextState[collapseKey] = true;
      }

      return nextState;
    });
  };

  const getExampleItemIndex = (itemId: string) => activeExampleDrafts.findIndex((item) => item.id === itemId);

  const updateExampleItemName = (itemId: string, name: string) => {
    const targetIndex = getExampleItemIndex(itemId);
    const target = activeExampleDrafts[targetIndex];
    if (!target) {
      return;
    }

    const hasChildItems = activeExampleDrafts.some((item) => item.parentPath === target.path);
    if (hasChildItems && !name.trim()) {
      return;
    }

    const trimmedName = name.trim();
    const nextPath = trimmedName
      ? buildDefinitionPath(target.parentPath, trimmedName)
      : buildDefinitionDraftPath(target.parentPath, target.id);
    const nextDrafts = activeExampleDrafts.map((item) => {
      if (item.path !== target.path && !item.path.startsWith(`${target.path}.`)) {
        return item;
      }

      if (item.path === target.path) {
        return {
          ...item,
          name,
          path: nextPath,
        };
      }

      const suffix = item.path.slice(target.path.length);
      const descendantPath = nextPath ? `${nextPath}${suffix}` : suffix.replace(/^\./, '');
      const segments = descendantPath.split('.').filter(Boolean);
      const nextName = item.name.trim() ? segments[segments.length - 1] ?? item.name : item.name;

      return {
        ...item,
        path: descendantPath,
        name: nextName,
        parentPath: segments.length > 1 ? segments.slice(0, -1).join('.') : null,
        depth: Math.max(segments.length - 1, 0),
      };
    });

    persistActiveExampleDrafts(nextDrafts);
  };

  const updateExampleItemValue = (itemId: string, value: unknown) => {
    persistActiveExampleDrafts(
      activeExampleDrafts.map((item) =>
        item.id === itemId
          ? {
              ...item,
              value,
            }
          : item,
      ),
    );
  };

  const updateExampleItemType = (itemId: string, nextType: ExampleValueType) => {
    const targetIndex = getExampleItemIndex(itemId);
    const target = activeExampleDrafts[targetIndex];
    if (!target) {
      return;
    }

    const getNextValue = () => {
      if (nextType === 'object') {
        return isRecord(target.value) ? target.value : {};
      }

      if (nextType === 'array') {
        return Array.isArray(target.value) ? target.value : [];
      }

      return getDefaultValueByType(nextType);
    };

    const nextDrafts = activeExampleDrafts
      .filter((item, currentIndex) => {
        if (currentIndex === targetIndex) {
          return true;
        }

        if (nextType === 'object') {
          return true;
        }

        return !item.path.startsWith(`${target.path}.`);
      })
      .map((item) =>
        item.id === itemId
          ? {
              ...item,
              value: getNextValue(),
            }
          : item,
      );

    persistActiveExampleDrafts(nextDrafts);
  };

  const removeExampleItem = (itemId: string) => {
    const targetIndex = getExampleItemIndex(itemId);
    const target = activeExampleDrafts[targetIndex];
    if (!target) {
      return;
    }

    persistActiveExampleDrafts(
      activeExampleDrafts.filter((item) => item.path !== target.path && !item.path.startsWith(`${target.path}.`)),
    );
  };

  const addRootExampleItem = () => {
    persistActiveExampleDrafts([...activeExampleDrafts, createExampleItemDraft(null, 0, '', '')]);
  };

  const addChildExampleItem = (itemId: string) => {
    const targetIndex = getExampleItemIndex(itemId);
    const parent = activeExampleDrafts[targetIndex];
    if (!parent) {
      return;
    }

    const parentValueType = getExampleValueType(parent.value);
    if (parentValueType !== 'object' || !parent.path.trim()) {
      return;
    }

    const insertAt = getBranchEndIndex(activeExampleDrafts, parent.path);
    const nextDrafts = [...activeExampleDrafts];
    nextDrafts.splice(insertAt, 0, createExampleItemDraft(parent.path, parent.depth + 1, '', ''));
    persistActiveExampleDrafts(nextDrafts);
  };

  const renderExampleItemValue = (item: ExampleItemDraft, hasChildItems: boolean) => {
    const valueType = getExampleValueType(item.value);

    if (valueType === 'object') {
      return (
        <Typography.Text type='secondary'>
          {hasChildItems ? '' : t('requestEmptyObjectHint')}
        </Typography.Text>
      );
    }

    return (
      <ExampleValueEditor
        disabled={disabled}
        value={item.value}
        onChange={(nextValue) => updateExampleItemValue(item.id, nextValue)}
      />
    );
  };

  const renderExampleItemCard = (item: ExampleItemDraft): React.ReactNode => {
    if (!activeSource) {
      return null;
    }

    const childItems = exampleChildrenMap.get(item.path) ?? [];
    const hasChildItems = childItems.length > 0;
    const valueType = getExampleValueType(item.value);
    const canAddChild = valueType === 'object' || hasChildItems;
    const isCollapsed = Boolean(collapsedExamplePaths[`${activeSource.id}:${item.path}`]);

    return (
      <div
        className={`grl-request-tab__definition-card ${
          valueType === 'object' || hasChildItems ? 'grl-request-tab__definition-card--object' : ''
        }`}
        key={item.id}
      >
        <div className='grl-request-tab__definition-row'>
          <div
            className='grl-request-tab__definition-key'
            style={{ '--definition-depth': item.depth } as React.CSSProperties}
          >
            <div className='grl-request-tab__definition-key__inner'>
              {item.depth > 0 && <span className='grl-request-tab__definition-key__guide' aria-hidden />}
              <div className='grl-request-tab__definition-key__content'>
                {hasChildItems ? (
                  <Button
                    type='text'
                    size='small'
                    disabled={disabled}
                    className='grl-request-tab__definition-toggle'
                    icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
                    onClick={() => toggleExampleCollapsed(item.path)}
                  />
                ) : (
                  <span className='grl-request-tab__definition-toggle-spacer' aria-hidden />
                )}
                <BlurCommitInput
                  disabled={disabled}
                  placeholder={item.depth > 0 ? t('requestChildFieldNamePlaceholder') : t('requestFieldNamePlaceholder')}
                  value={item.name}
                  onCommit={(nextValue) => updateExampleItemName(item.id, nextValue)}
                />
              </div>
            </div>
          </div>
          <Select
            disabled={disabled}
            value={valueType}
            options={exampleValueTypeOptions}
            onChange={(nextValue: ExampleValueType) => updateExampleItemType(item.id, nextValue)}
          />
          <div className='grl-request-tab__example-value'>{renderExampleItemValue(item, hasChildItems)}</div>
          <div className='grl-request-tab__definition-actions'>
            {canAddChild && (
              <Tooltip title={t('requestAddChildField')}>
                <Button
                  type='text'
                  size='small'
                  disabled={disabled || !item.name.trim() || valueType !== 'object'}
                  icon={<PlusOutlined />}
                  onClick={() => addChildExampleItem(item.id)}
                />
              </Tooltip>
            )}
            <Button
              danger
              type='text'
              disabled={disabled}
              icon={<DeleteOutlined />}
              onClick={() => removeExampleItem(item.id)}
            />
          </div>
        </div>
        {hasChildItems && !isCollapsed && (
          <div className='grl-request-tab__definition-children'>
            {childItems.map((childItem) => renderExampleItemCard(childItem))}
          </div>
        )}
      </div>
    );
  };

  const addExampleSource = () => {
    const baseExampleSources = exampleSources;
    const nextSources = [
      ...baseExampleSources,
      {
        id: crypto.randomUUID(),
        name: getExampleSourceName(baseExampleSources.length),
        data: normalizeRequestExampleDataByDefinitions(
          buildRequestExampleTemplateFromDefinitions(definitionDrafts),
          definitionDrafts,
        ),
        source: 'schema.examples' as const,
      },
    ];

    persistExamples(nextSources, nextSources.length - 1);
  };

  const removeExampleSource = (index: number) => {
    const baseExampleSources = exampleSources;
    const nextSources = baseExampleSources.filter((_, currentIndex) => currentIndex !== index);
    persistExamples(nextSources, Math.max(index - 1, 0));
  };

  const getSafeJsonFileName = (name?: string) => {
    const trimmed = (name ?? '').trim();
    const baseName = trimmed.length > 0 ? trimmed : nodeName || t('request');
    const normalized = baseName
      .replace(/\.json$/i, '')
      .replace(/[\\/:*?"<>|]/g, '-')
      .trim();

    return `${normalized || t('request')}.json`;
  };

  const handleUploadJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = json5.parse(text);

      if (!isRecord(parsed)) {
        message.error(t('requestUploadJsonObjectRequired'));
        return;
      }

      const nextSourceName = file.name.replace(/\.json$/i, '') || getExampleSourceName(exampleSources.length);
      const nextSourceData = parsed as Record<string, unknown>;

      if (exampleSources.length === 0) {
        persistExamples(
          [
            {
              id: crypto.randomUUID(),
              name: nextSourceName,
              data: nextSourceData,
              source: 'schema.examples',
            },
          ],
          0,
        );
      } else {
        persistExamples(
          exampleSources.map((source, index) =>
            index === activeSourceIndex
              ? {
                  ...source,
                  name: nextSourceName,
                  data: nextSourceData,
                  source: 'schema.examples',
                }
              : source,
          ),
          activeSourceIndex,
        );
      }

      message.success(t('requestUploadJsonSuccess'));
    } catch (error: any) {
      console.warn('[request-node] failed to upload json', {
        nodeId: id,
        error,
      });
      message.error(error?.message || t('requestUploadJsonFailed'));
    }
  };

  const handleDownloadJson = () => {
    if (!activeSource) {
      message.warning(t('requestDownloadJsonNoData'));
      return;
    }

    const payload = JSON.stringify(normalizeExampleData(activeSource.data), null, 2);
    saveFile(getSafeJsonFileName(activeSource.name), new Blob([payload], { type: 'application/json' }));
  };

  const renderTabBarExtraContent = () => {
    if (activeTab === RequestTabKey.Examples) {
      return (
        <Space size='small' style={{ marginRight: 8 }}>
          <Tooltip title={t('requestUploadJsonTooltip')}>
            <Button
              type='text'
              size='small'
              disabled={disabled}
              icon={<CloudUploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('uploadJson')}
            </Button>
          </Tooltip>
          <Tooltip title={t('requestDownloadJsonTooltip')}>
            <Button
              type='text'
              size='small'
              disabled={!activeSource}
              icon={<CloudDownloadOutlined />}
              onClick={handleDownloadJson}
            >
              {t('downloadJson')}
            </Button>
          </Tooltip>
        </Space>
      );
    }

    if (activeTab === RequestTabKey.Schema) {
      return (
        <Space size='small' style={{ marginRight: 8 }}>
          <Tooltip title={t('requestFormatSchema')} placement='bottomRight'>
            <Button
              type='text'
              size='small'
              shape='circle'
              icon={<FormatPainterOutlined />}
              onClick={() => schemaEditorRef.current?.getAction?.('editor.action.formatDocument')?.run?.()}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title={t('convertToJsonSchema')} placement='bottomRight'>
            <Button
              type='text'
              size='small'
              shape='circle'
              icon={<ImportOutlined />}
              onClick={() => setJsonToJsonSchemaOpen(true)}
              disabled={disabled}
            />
          </Tooltip>
        </Space>
      );
    }

    return null;
  };

  return (
    <div
      className='grl-node-content'
      data-theme={token.mode}
      style={
        {
          height: '100%',
          '--color-text': token.colorTextBase,
          '--color-background-elevated': token.colorBgElevated,
          '--color-border': token.colorBorder,
          '--color-border-secondary': token.colorBorderSecondary,
          '--color-fill-secondary': token.colorFillSecondary,
          '--color-fill-tertiary': token.colorFillTertiary,
          '--color-primary-bg': token.colorPrimaryBg,
          '--color-primary-border': token.colorPrimaryBorder,
          '--color-primary-text': token.colorPrimaryText,
        } as React.CSSProperties
      }
    >
      <div className='grl-node-content-main grl-request-tab'>
        <div className='grl-node-content-side'>
          <div className='grl-node-content-side__panel'>
            <div className='grl-node-content-side__header'>
              <Tabs
                rootClassName='grl-inline-tabs'
                size='small'
                style={{ width: '100%' }}
                activeKey={activeTab}
                onChange={(nextKey) => {
                  const resolvedTabKey = nextKey as RequestTabKey;
                  setActiveTab(resolvedTabKey);

                  if (resolvedTabKey === RequestTabKey.Examples && activePanel !== 'simulator') {
                    openSimulatorPanel();
                  }
                }}
                items={[
                  { key: RequestTabKey.Definitions, label: t('requestDefinitionsTab') },
                  { key: RequestTabKey.Examples, label: t('requestExamplesTab') },
                  {
                    key: RequestTabKey.Schema,
                    label: (
                      <span>
                        {t('schema')}
                        <Tooltip title={t('requestSchemaPriorityTooltip')}>
                          <InfoCircleOutlined
                            style={{ fontSize: 10, marginLeft: 4, opacity: 0.5, verticalAlign: 'text-top' }}
                          />
                        </Tooltip>
                      </span>
                    ),
                  },
                ]}
                tabBarExtraContent={renderTabBarExtraContent()}
              />
              <input
                hidden
                accept='application/json'
                type='file'
                ref={fileInputRef}
                onChange={handleUploadJson}
                onClick={(event) => {
                  (event.target as HTMLInputElement).value = '';
                }}
              />
            </div>
            <div className='grl-node-content-side__body'>
              {activeTab === RequestTabKey.Definitions && (
                <div className='grl-request-tab__body'>
                  <div className='grl-request-tab__surface grl-request-tab__surface--definitions'>
                    <div className='grl-request-tab__grid grl-request-tab__grid--definitions'>
                      <div className='grl-request-tab__grid-header grl-request-tab__grid-header--definitions'>
                        <span>{t('key')}</span>
                        <span>{t('type')}</span>
                        <span>{t('description')}</span>
                        <span />
                      </div>

                      {rootDefinitions.length === 0 ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={t('requestNoDefinitions')}
                        />
                      ) : (
                        rootDefinitions.map((definition) => renderDefinitionCard(definition))
                      )}
                    </div>
                  </div>

                  <div className='grl-request-tab__add-row'>
                    <Button
                      className='grl-request-tab__add-row__button'
                      type='link'
                      icon={<PlusCircleOutlined />}
                      disabled={disabled}
                      onClick={addDefinition}
                    >
                      {t('requestAddField')}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === RequestTabKey.Examples && (
                <div className='grl-request-tab__body'>
                  <div className='grl-request-tab__hero'>
                    <Space wrap>
                      <Button type='primary' icon={<PlusOutlined />} disabled={disabled} onClick={addExampleSource}>
                        {t('requestAddDataSource')}
                      </Button>
                    </Space>
                  </div>

                  {exampleSources.length === 0 ? (
                    <Card className='grl-request-tab__surface'>
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('requestNoDataSources')}
                      >
                        <Button type='primary' icon={<PlusOutlined />} disabled={disabled} onClick={addExampleSource}>
                          {t('requestCreateDataSource')}
                        </Button>
                      </Empty>
                    </Card>
                  ) : (
                    <div className='grl-request-tab__examples-layout'>
                      <div className='grl-request-tab__source-list'>
                        {exampleSources.map((source, index) => (
                          <Card
                            key={source.id}
                            hoverable
                            className={`grl-request-tab__source-card ${
                              index === activeSourceIndex ? 'grl-request-tab__source-card--active' : ''
                            }`}
                            onClick={() => {
                              setActiveSourceIndex(index);
                              syncExampleToSimulator(source, index);
                            }}
                          >
                            <div className='grl-request-tab__source-card__content'>
                              <div className='grl-request-tab__source-card__header'>
                                <div className='grl-request-tab__source-card__title'>
                                  <Typography.Text strong ellipsis={{ tooltip: source.name }}>
                                    {source.name}
                                  </Typography.Text>
                                </div>
                                {source.source === 'schema.examples' && (
                                  <Popconfirm
                                    title={t('requestDeleteDataSourceConfirm')}
                                    okText={t('delete')}
                                    cancelText={t('cancel')}
                                    onConfirm={(event) => {
                                      event?.stopPropagation?.();
                                      removeExampleSource(index);
                                    }}
                                  >
                                    <Button
                                      danger
                                      type='text'
                                      size='small'
                                      disabled={disabled}
                                      icon={<DeleteOutlined />}
                                      onClick={(event) => event.stopPropagation()}
                                    />
                                  </Popconfirm>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === RequestTabKey.Schema && (
                <div className='grl-request-tab__body grl-request-tab__body--schema'>
                  <div className='grl-request-tab__surface grl-request-tab__surface--schema'>
                    <div className='grl-request-tab__schema-shell'>
                      <div className='grl-request-tab__schema-editor'>
                        <Editor
                          height='100%'
                          language='json'
                          value={schemaDraft}
                          onMount={(instance) => {
                            schemaEditorRef.current = instance;
                            schemaEditorBlurDisposableRef.current?.dispose();
                            schemaEditorBlurDisposableRef.current = instance.onDidBlurEditorText(() => {
                              commitSchemaDraft();
                            });
                          }}
                          onChange={(value) => handleSchemaDraftChange(value ?? '')}
                          theme={token.mode === 'dark' ? 'vs-dark' : 'light'}
                          options={{
                            ...schemaEditorOptions,
                            readOnly: disabled,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <JsonToJsonSchemaDialog
                    isOpen={jsonToJsonSchemaOpen}
                    onDismiss={() => setJsonToJsonSchemaOpen(false)}
                    onSuccess={handleConvertToJsonSchemaSuccess}
                    model={localStorage.getItem(`${id}-request-model`) || undefined}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
