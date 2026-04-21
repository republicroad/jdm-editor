import { VariableType } from '@gorules/zen-engine-wasm';
import { useMemo } from 'react';

import {
  type DecisionGraphStoreType,
  NodeTypeKind,
  useDecisionGraphState,
} from '../components/decision-graph/context/dg-store.context';
import { isWasmAvailable, useWasmReady } from './wasm';

type NodeTypeParams = {
  attachGlobals?: boolean;
  disabled?: boolean;
};

const getNodeType = (nodeTypes: DecisionGraphStoreType['state']['nodeTypes'], id: string) =>
  nodeTypes[id]?.[NodeTypeKind.Input] ??
  nodeTypes[id]?.[NodeTypeKind.InferredInput] ??
  VariableType.fromJson({ Object: {} });

export const useNodeType = (id: string, { attachGlobals = true, disabled = false }: NodeTypeParams = {}) => {
  const wasmReady = useWasmReady();
  const typeInfo = useDecisionGraphState(({ nodeTypes, globalType }) => ({ nodeTypes, globalType }));

  return useMemo(() => {
    if (!wasmReady || !isWasmAvailable() || disabled || !typeInfo?.nodeTypes) {
      return undefined;
    }

    const nodeType = getNodeType(typeInfo.nodeTypes, id);
    if (!attachGlobals) {
      return nodeType;
    }

    Object.entries(typeInfo?.globalType ?? {}).forEach(([k, v]) => nodeType.set(k, v));
    return nodeType;
  }, [wasmReady, disabled, id, typeInfo?.globalType, typeInfo?.nodeTypes, attachGlobals]);
};
