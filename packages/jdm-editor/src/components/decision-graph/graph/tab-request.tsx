import type { DragDropManager } from 'dnd-core';
import React from 'react';
import { P, match } from 'ts-pattern';
import type { z } from 'zod';

import { getNodeData } from '../../../helpers/node-data';
import { expressionNodeSchema } from '../../../helpers/schema';
import type { ExpressionPermission } from '../../request-table/context/expression-store.context';
import { Expression } from '../../request-table';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import type { SimulationTrace, SimulationTraceDataExpression } from '../simulator/simulation.types';
import { fJson } from '../../../helpers/utility';

export type TabRequestProps = {
  id: string;
  manager?: DragDropManager;
  menuList?: any[];
  type?: string;
};

export const TabRequest: React.FC<TabRequestProps> = ({ id, manager, menuList, type }) => {
  const graphActions = useDecisionGraphActions();
  const { disabled, configurable, content } = useDecisionGraphState(({ disabled, configurable, decisionGraph }) => ({
    disabled,
    configurable,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content,
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
            result.snapshot?.nodes?.find((n) => n.id === id)?.content as z.infer<typeof expressionNodeSchema>['content'],
        )
        .otherwise(() => null),
      viewConfig,
    }),
  );

  const debug = match([nodeTrace, inputData, nodeSnapshot])
    .with([P.nonNullable, P.nonNullable, P.nonNullable], ([trace, inputData, snapshot]) => ({
      trace,
      inputData,
      snapshot,
    }))
    .otherwise(() => undefined);


  return (
    <div style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <Expression
        value={content ? content.inputs : ''}
        onChange={(val) => {
          graphActions.updateNode(id, (draft) => {
            if (!draft.content) {
              draft.content = { inputs: val }; // 如果 content 不存在，则在 draft 上新增 content 对象并设置 inputs 为 val
            } else {
              draft.content.inputs = val; // 如果 content 存在，则直接设置 inputs 为 val
            }
            return draft;
          });
          graphActions.setSimulatorRequest(fJson(val))
        }}
        disabled={disabled}
        configurable={configurable}
        manager={manager}
        menuList={menuList}
      />
    </div>
  );
};

