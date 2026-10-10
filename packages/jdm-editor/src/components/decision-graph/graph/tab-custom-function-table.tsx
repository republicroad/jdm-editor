import React, { useMemo } from 'react';
import { P, match } from 'ts-pattern';
import type { z } from 'zod';

import { editorValueToNamedCall, resolveFunctionScope } from '../../../helpers/custom-function-schema';
import type { GetNodeDataResult } from '../../../helpers/node-data';
import { getNodeData } from '../../../helpers/node-data';
import { useNodeType } from '../../../helpers/node-type';
import type { customNodeSchema } from '../../../helpers/schema';
import { get } from '../../../helpers/utility';
import { isWasmAvailable } from '../../../helpers/wasm';
import { CustomFunction } from '../../custom-function-table';
import type { ExpressionPermission } from '../../custom-function-table/context/expression-store.context';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import type { SimulationTrace, SimulationTraceDataExpression } from '../simulator/simulation.types';

export type TabCustomFunctionProps = {
  id: string;
  user?: string;
  customFunctions?: any;
};

export const CustomFunctionTable: React.FC<TabCustomFunctionProps> = ({ id, user, customFunctions }) => {
  const graphActions = useDecisionGraphActions();
  const nodeType = useNodeType(id, { attachGlobals: false });
  const { disabled, content, globalType } = useDecisionGraphState(({ disabled, decisionGraph, globalType }) => ({
    disabled,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content,
    globalType,
  }));

  const { nodeTrace, inputData, nodeSnapshot, viewConfig } = useDecisionGraphState(
    ({ simulate, decisionGraph, viewConfig }) => ({
      nodeTrace: match(simulate)
        .with(
          { result: P.nonNullable },
          ({ result }) => result.trace[id] as SimulationTrace<SimulationTraceDataExpression>,
        )
        .otherwise(() => null),
      inputData: match(simulate)
        .with({ result: P.nonNullable }, ({ result }) => getNodeData(id, { trace: result.trace, decisionGraph }))
        .otherwise(() => null),
      nodeSnapshot: match(simulate)
        .with(
          { result: P.nonNullable },
          ({ result }) =>
            result.snapshot?.nodes?.find((n) => n.id === id)?.content as z.infer<typeof customNodeSchema>['content'],
        )
        .otherwise(() => null),
      viewConfig,
    }),
  );

  const functionScope = useMemo(
    () => resolveFunctionScope((content as { kind?: string } | undefined)?.kind, customFunctions),
    [content?.kind, customFunctions],
  );

  const expressions = (content?.config as { expressions?: any } | undefined)?.expressions;

  // ADR-015 #3（seal ADR-022 移植）：写路径归一为规范形 {$call, kwargs}（编辑器位置数组经
  // 声明序映射；priorKwargs 并回保非位置额外键）；expr_asts 停写（引擎派生，零风险）
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

  const inputVariableType = useMemo(() => {
    if (!nodeType) {
      return undefined;
    }

    let scopedType = nodeType.clone();
    if (content?.config?.inputField) {
      scopedType = scopedType.calculateType(content.config.inputField);
    }

    if (content?.config?.executionMode === 'loop') {
      scopedType = scopedType.arrayItem();
    }

    Object.entries(globalType ?? {}).forEach(([key, value]) => scopedType.set(key, value));

    return scopedType;
  }, [nodeType, content?.config?.inputField, content?.config?.executionMode, globalType]);

  const debug = useMemo(() => {
    if (!nodeTrace || !inputData || !nodeSnapshot) {
      return undefined;
    }

    if (!isWasmAvailable()) {
      return { trace: nodeTrace, snapshot: nodeSnapshot.config };
    }

    const $data = Object.fromEntries(
      Object.entries(nodeTrace.traceData || {}).map(([k, v]) => [k, safeJson(v.result)]),
    );
    const extendedInputData: GetNodeDataResult = {
      ...inputData,
      $: $data,
    };

    if (content?.config?.inputField) {
      extendedInputData.data = get(extendedInputData.data, content.config.inputField, {});
    }

    return { trace: nodeTrace, inputData: extendedInputData, snapshot: nodeSnapshot.config };
  }, [nodeTrace, nodeSnapshot, inputData]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <CustomFunction
        value={content?.config?.expressions}
        disabled={disabled}
        permission={(viewConfig?.enabled ? viewConfig?.permissions?.[id] : 'edit:full') as ExpressionPermission}
        customFunctions={customFunctions}
        functionScope={functionScope}
        debug={debug as any}
        inputVariableType={inputVariableType}
        onChange={persistExpressions}
      />
    </div>
  );
};

const safeJson = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};
