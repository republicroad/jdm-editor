import { useEffect, useMemo, useRef, useState } from 'react';

import {
  type RequestContentLike,
  applySchemaTextToInputContract,
  hasOwn,
  isRecord,
  parseRequestSchemaValue,
  readRequestInputContract,
  stringifyRequestSchemaValue,
  writeRequestInputContract,
} from '../../../helpers/request-schema';
import type { useDecisionGraphActions } from '../context/dg-store.context';

type UseRequestSchemaEditingParams = {
  id: string;
  type?: string;
  content: RequestContentLike | undefined;
  graphActions: ReturnType<typeof useDecisionGraphActions>;
};

export const useRequestSchemaEditing = ({ id, type, content, graphActions }: UseRequestSchemaEditingParams) => {
  const [jsonToJsonSchemaOpen, setJsonToJsonSchemaOpen] = useState(false);

  // InputContract（ADR-013）为唯一事实源：schema 视图编辑的是契约的 schema
  // 投影（不再含内嵌 examples——它们归契约 examples 所有）
  const contract = useMemo(
    () => readRequestInputContract(content).contract,
    [content?.schema, content?.schemaUI, content?.inputs, content?.inputContract],
  );
  const sourceSchemaValue = contract.schema;
  const schemaText = useMemo(() => {
    const text = stringifyRequestSchemaValue(contract.schema);
    return text === '{}' ? '' : text;
  }, [contract.schema]);
  const persistedSchemaText = schemaText;

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
        // 契约写路径：draft 内新读契约（最新状态），结构文本并入，
        // 内嵌 examples（粘贴的 legacy 形态）按序并入契约示例集，双写镜像
        const contentRecord = draft.content as RequestContentLike & Record<string, any>;
        const { contract: freshContract } = readRequestInputContract(contentRecord);
        const nextContract = applySchemaTextToInputContract(freshContract, nextSchema);
        writeRequestInputContract(contentRecord, nextContract);
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

      // '{}' 等价于空 schema（契约投影把空对象归一化为 '' 展示），
      // 空白 blur 不得触发无谓写入（否则会给未编辑过的节点种下 inputContract）
      const persistedText = stringifyRequestSchemaValue(contentSchemaRef.current);
      if (persistedText.trim() && persistedText !== '{}') {
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

    // 内嵌 examples 的保留由 applySchemaTextToInputContract 按序并入契约完成
    pendingSchemaCommitRef.current = schema;
    applyExternalSchemaDraft(schema, { dirty: false });
    updateNodeSchema(schema);
  };

  return {
    contract,
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
