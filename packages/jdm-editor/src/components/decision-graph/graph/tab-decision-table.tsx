import type { DragDropManager } from 'dnd-core';
import React, { useEffect, useMemo, useRef } from 'react';
import { P, match } from 'ts-pattern';

import { getNodeData } from '../../../helpers/node-data';
import { useNodeType } from '../../../helpers/node-type';
import { get } from '../../../helpers/utility';
import { isWasmAvailable } from '../../../helpers/wasm';
import type { DecisionTableType, TableScrollApi } from '../../decision-table';
import { DecisionTable } from '../../decision-table';
import type { DecisionTablePermission } from '../../decision-table/context/dt-store.context';
import { NodeTypeKind, useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';

const shouldLogDecisionTableContext = import.meta.env.DEV;
import { useTabSerializer } from '../context/serializer.context';
import type { NodeDecisionTableData } from '../nodes/specifications/decision-table.specification';
import type { SimulationTrace, SimulationTraceDataTable } from '../simulator/simulation.types';

type TableScrollSnapshot = { rowIndex: number; scrollLeft: number };

export type TabDecisionTableProps = {
  id: string;
  manager?: DragDropManager;
};

export const TabDecisionTable: React.FC<TabDecisionTableProps> = ({ id, manager }) => {
  const graphActions = useDecisionGraphActions();
  const nodeType = useNodeType(id, { attachGlobals: false });
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollApiRef = useRef<TableScrollApi | null>(null);

  useTabSerializer<TableScrollSnapshot>(id, 'scroll', {
    serialize: () => ({
      rowIndex: scrollApiRef.current?.getTopRowIndex() ?? 0,
      scrollLeft: scrollContainerRef.current?.scrollLeft ?? 0,
    }),
    restore: (snapshot) => {
      if (!snapshot) return;
      let attempts = 0;
      const apply = () => {
        const api = scrollApiRef.current;
        const el = scrollContainerRef.current;
        if (!api || !el || el.scrollHeight <= el.clientHeight) {
          if (attempts++ < 60) requestAnimationFrame(apply);
          return;
        }
        api.scrollToRowIndex(snapshot.rowIndex);
        el.scrollLeft = snapshot.scrollLeft;
      };
      requestAnimationFrame(apply);
    },
  });
  const { nodeName, nodeTrace, inputData, nodeSnapshot, viewConfig, dictionaries, mode } = useDecisionGraphState(
    ({ simulate, decisionGraph, viewConfig, dictionaries, mode }) => ({
      nodeName: decisionGraph.nodes.find((n) => n.id === id)?.name,
      nodeTrace: match(simulate)
        .with({ result: P.nonNullable }, ({ result }) => result.trace[id] as SimulationTrace<SimulationTraceDataTable>)
        .otherwise(() => null),
      inputData: match(simulate)
        .with({ result: P.nonNullable }, ({ result }) => getNodeData(id, { trace: result.trace, decisionGraph }))
        .otherwise(() => null),
      nodeSnapshot: match(simulate)
        .with(
          { result: P.nonNullable },
          ({ result }) => (result.snapshot?.nodes || []).find((n) => n.id === id)?.content as DecisionTableType,
        )
        .otherwise(() => null),
      viewConfig,
      dictionaries,
      mode,
    }),
  );

  const { disabled, content, globalType, upstreamNodeOutputs } = useDecisionGraphState(({ disabled, decisionGraph, globalType, nodeTypes }) => ({
    disabled,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as NodeDecisionTableData,
    globalType,
    upstreamNodeOutputs: (decisionGraph?.edges ?? [])
      .filter((edge) => edge.targetId === id)
      .map((edge) => (decisionGraph?.nodes ?? []).find((node) => node.id === edge.sourceId))
      .filter((node): node is NonNullable<typeof node> => !!node)
      .map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        outputType:
          nodeTypes[node.id]?.[NodeTypeKind.Output]?.toJson() ??
          nodeTypes[node.id]?.[NodeTypeKind.InferredOutput]?.toJson() ??
          null,
      })),
  }));

  const inputVariableType = useMemo(() => {
    if (!nodeType) {
      return undefined;
    }

    let scopedType = nodeType.clone();
    if (content?.inputField) {
      scopedType = scopedType.calculateType(content.inputField);
    }

    if (content?.executionMode === 'loop') {
      scopedType = scopedType.arrayItem();
    }

    Object.entries(globalType ?? {}).forEach(([key, value]) => scopedType.set(key, value));

    return scopedType;
  }, [nodeType, content?.inputField, content?.executionMode, globalType]);

  useEffect(() => {
    if (!shouldLogDecisionTableContext) {
      return;
    }

    console.log('[decision-table-context] resolved input variable type', {
      nodeId: id,
      nodeName,
      inputField: content?.inputField ?? null,
      executionMode: content?.executionMode ?? 'single',
      upstreamNodeOutputs,
      nodeInputType: nodeType?.toJson(),
      resolvedInputType: inputVariableType?.toJson(),
    });
  }, [id, nodeName, content?.inputField, content?.executionMode, upstreamNodeOutputs, nodeType, inputVariableType]);

  const debug = useMemo(() => {
    if (!nodeTrace || !inputData) {
      return undefined;
    }

    // 如果 nodeSnapshot 缺失，使用当前节点内容作为降级，并转换类型
    const fallbackSnapshot = nodeSnapshot || (content ? {
      ...content,
      inputField: content.inputField || undefined, // 将 null 转换为 undefined
    } as DecisionTableType : null);
    if (!fallbackSnapshot) {
      return undefined;
    }

    if (!isWasmAvailable()) {
      return { trace: nodeTrace, snapshot: fallbackSnapshot };
    }

    const extendedInputData = { ...inputData };
    if (content?.inputField) {
      extendedInputData.data = get(extendedInputData.data, content.inputField, {});
    }

    return { trace: nodeTrace, inputData: extendedInputData, snapshot: fallbackSnapshot };
  }, [nodeTrace, nodeSnapshot, inputData, content]);

  return (
    <DecisionTable
      id={id}
      name={nodeName}
      tableHeight={'100%'}
      value={content as any}
      manager={manager}
      scrollContainerRef={scrollContainerRef}
      scrollApiRef={scrollApiRef}
      disabled={disabled}
      permission={viewConfig?.enabled ? (viewConfig?.permissions?.[id] as DecisionTablePermission) : 'edit:full'}
      dictionaries={dictionaries}
      inputVariableType={inputVariableType}
      mode={mode}
      debug={debug}
      onChange={(val) => {
        graphActions.updateNode(id, (draft) => {
          Object.assign(draft.content, val);
          return draft;
        });
      }}
    />
  );
};
