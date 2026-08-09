import type { editor } from 'monaco-editor';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  type RequestContentLike,
  getRequestSchemaSourceValue,
  hasOwn,
  isRecord,
  parseRequestSchemaValue,
  resolveRequestSchemaValue,
  setRequestSchemaValue,
  stringifyRequestSchemaValue,
} from '../../../helpers/request-schema';
import { useDecisionGraphActions } from '../context/dg-store.context';

type UseRequestSchemaEditingParams = {
  id: string;
  type?: string;
  content: RequestContentLike | undefined;
  graphActions: ReturnType<typeof useDecisionGraphActions>;
};

export const useRequestSchemaEditing = ({ id, type, content, graphActions }: UseRequestSchemaEditingParams) => {
  const schemaEditorRef = useRef<editor.IStandaloneCodeEditor>();
  const [jsonToJsonSchemaOpen, setJsonToJsonSchemaOpen] = useState(false);

  const sourceSchemaValue = useMemo(
    () => getRequestSchemaSourceValue(content),
    [content?.schema, content?.schemaUI, content?.inputs],
  );
  const schemaObject = useMemo(
    () => resolveRequestSchemaValue(content, { includeExamples: true }),
    [content?.schema, content?.schemaUI, content?.inputs],
  );
  const schemaText = useMemo(() => stringifyRequestSchemaValue(schemaObject), [schemaObject]);
  const persistedSchemaText = useMemo(
    () => stringifyRequestSchemaValue(sourceSchemaValue) || schemaText,
    [sourceSchemaValue, schemaText],
  );

  const [schemaDraft, setSchemaDraft] = useState(persistedSchemaText);
  const [isSchemaDraftDirty, setIsSchemaDraftDirty] = useState(false);
  const schemaDraftRef = useRef(schemaDraft);
  const persistedSchemaTextRef = useRef(persistedSchemaText);
  const pendingExternalSchemaDraftValueRef = useRef<string | null>(null);
  const initializedSchemaSyncNodeIdsRef = useRef<Set<string>>(new Set());
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

    const sourceSchemaObj = parseRequestSchemaValue(sourceSchemaValue);
    const hasPersistedSchemaProperties = Boolean(
      sourceSchemaObj && hasOwn(sourceSchemaObj, 'properties') && isRecord(sourceSchemaObj.properties),
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
  }, [content?.inputs, id, schemaText, sourceSchemaValue]);

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
  };

  return {
    schemaEditorRef,
    sourceSchemaValue,
    schemaDraft,
    jsonToJsonSchemaOpen,
    setJsonToJsonSchemaOpen,
    updateNodeSchema,
    handleSchemaDraftChange,
    commitSchemaDraft,
    handleConvertToJsonSchemaSuccess,
  };
};
