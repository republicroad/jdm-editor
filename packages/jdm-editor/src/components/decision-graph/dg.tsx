import clsx from 'clsx';
import type { DragDropManager } from 'dnd-core';
import equal from 'fast-deep-equal/es6/react';
import React, { forwardRef, useEffect, useMemo } from 'react';
import { ReactFlowProvider } from 'reactflow';

import {
  findCustomFunctionDefinition,
  getFunctionNameFromValue,
  getFunctionReturnSchema,
  isFunctionExpression,
  normalizeCustomFunctions,
  normalizeFunctionReturns,
} from '../../helpers/custom-function-schema';
import type { DecisionGraphContextProps } from './context/dg-store.context';
import { useDecisionGraphActions, useDecisionGraphState, DecisionGraphProvider } from './context/dg-store.context';
import type { DecisionGraphEmptyType } from './dg-empty';
import { DecisionGraphEmpty } from './dg-empty';
import { DecisionGraphInferTypes } from './dg-infer';
import type { DecisionGraphWrapperProps } from './dg-wrapper';
import { DecisionGraphWrapper } from './dg-wrapper';
import './dg.scss';
import type { GraphRef } from './graph/graph';
import { NodeKind } from './nodes/specifications/specification-types';

export type DecisionGraphProps = {
  manager?: DragDropManager;
} & DecisionGraphWrapperProps &
  DecisionGraphContextProps &
  DecisionGraphEmptyType;

export type DecisionGraphRef = GraphRef;

export const DecisionGraph = forwardRef<DecisionGraphRef, DecisionGraphProps>(
  ({ manager: _, reactFlowProOptions, tabBarExtraContent, ...props }, ref) => {
    return (
      <div className={clsx(['grl-dg', props?.hideLeftToolbar && 'hidden-left-toolbar'])}>
        <ReactFlowProvider>
          <DecisionGraphProvider>
            <DecisionGraphWrapper
              ref={ref}
              reactFlowProOptions={reactFlowProOptions}
              tabBarExtraContent={tabBarExtraContent}
              userId={props.userId}
              projectId={props.projectId}
              ruleMetadata={props.ruleMetadata}
              menuList={props.menuList}
              customFunctions={props.customFunctions}
            />
            <CustomFunctionReturnSchemaSync customFunctions={props.customFunctions} />
            <DecisionGraphInferTypes />
            <DecisionGraphEmpty {...props} />
          </DecisionGraphProvider>
        </ReactFlowProvider>
      </div>
    );
  },
);

const shouldLogCustomFunctionSchemaSync = import.meta.env.DEV;

const CustomFunctionReturnSchemaSync: React.FC<Pick<DecisionGraphProps, 'customFunctions'>> = ({ customFunctions }) => {
  const graphActions = useDecisionGraphActions();
  const decisionGraph = useDecisionGraphState(({ decisionGraph }) => decisionGraph);
  const normalizedCustomFunctions = useMemo(() => normalizeCustomFunctions(customFunctions), [customFunctions]);

  useEffect(() => {
    if (!decisionGraph?.nodes?.length || normalizedCustomFunctions.length === 0) {
      return;
    }

    let updatedNodeCount = 0;
    let updatedExpressionCount = 0;

    const nextNodes = decisionGraph.nodes.map((node) => {
      if (node.type !== NodeKind.CustomFunction) {
        return node;
      }

      const expressions = node.content?.config?.expressions;
      if (!Array.isArray(expressions) || expressions.length === 0) {
        return node;
      }

      let nodeChanged = false;
      const nextExpressions = expressions.map((expression: any) => {
        if (!isFunctionExpression(expression)) {
          return expression;
        }

        const functionName = getFunctionNameFromValue(expression.value);
        const functionDefinition = findCustomFunctionDefinition(normalizedCustomFunctions, functionName);
        if (!functionDefinition) {
          return expression;
        }

        const nextReturnSchema = getFunctionReturnSchema(functionDefinition);
        if (equal(normalizeFunctionReturns(expression.returnSchema), nextReturnSchema)) {
          return expression;
        }

        nodeChanged = true;
        updatedExpressionCount += 1;

        return {
          ...expression,
          type: expression.type ?? 'function',
          returnSchema: nextReturnSchema,
        };
      });

      if (!nodeChanged) {
        return node;
      }

      updatedNodeCount += 1;

      return {
        ...node,
        content: {
          ...node.content,
          config: {
            ...node.content.config,
            expressions: nextExpressions,
          },
        },
      };
    });

    if (updatedNodeCount === 0) {
      return;
    }

    if (shouldLogCustomFunctionSchemaSync) {
      console.log('[custom-node returnSchema sync] hydrated schemas from customFunctions', {
        updatedNodeCount,
        updatedExpressionCount,
      });
    }

    graphActions.setDecisionGraph({ nodes: nextNodes });
  }, [decisionGraph, graphActions, normalizedCustomFunctions]);

  return null;
};
