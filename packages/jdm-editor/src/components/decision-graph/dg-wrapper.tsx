import type { ProOptions } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import clsx from 'clsx';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { match } from 'ts-pattern';

import { useDecisionGraphRaw, useDecisionGraphState } from './context/dg-store.context';
import { GraphPanel } from './dg-panel';
import type { UserResolver } from './dg-types';
import type { GraphRef } from './graph/graph';
import { Graph } from './graph/graph';
import { GraphNodes } from './graph/graph-nodes';
import { GraphSideToolbar } from './graph/graph-side-toolbar';
import type { GraphTabsProps } from './graph/graph-tabs';
import { GraphTabs } from './graph/graph-tabs';
import { decisionTableSpecification } from './nodes/specifications/decision-table.specification';
import { expressionSpecification } from './nodes/specifications/expression.specification';
import { functionSpecification } from './nodes/specifications/function.specification';
import { inputSpecification } from './nodes/specifications/input.specification';
import { outputSpecification } from './nodes/specifications/output.specification';
import { NodeKind } from './nodes/specifications/specification-types';

export type DecisionGraphWrapperProps = {
  reactFlowProOptions?: ProOptions;
  tabBarExtraContent?: GraphTabsProps['tabBarExtraContent'];
  userResolver?: UserResolver;
  customFunctions?: any;
};

const ResolveUserEffect: React.FC<{ userResolver?: UserResolver }> = ({ userResolver }) => {
  const { stateStore } = useDecisionGraphRaw();

  useEffect(() => {
    if (!userResolver) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await userResolver();
        if (!cancelled && result) {
          stateStore.setState({ user: result.user ?? '' });
        }
      } catch (err) {
        console.warn('[jdm-editor] userResolver failed:', err);
        if (!cancelled) {
          stateStore.setState({ user: '' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userResolver]);

  return null;
};

export const DecisionGraphWrapper = React.memo(
  forwardRef<GraphRef, DecisionGraphWrapperProps>(function DecisionGraphWrapperInner(
    { reactFlowProOptions, tabBarExtraContent, userResolver, customFunctions },
    ref,
  ) {
    const [disableTabs, setDisableTabs] = useState(false);
    const { hasActiveNode, viewConfig, hideLeftToolbar } = useDecisionGraphState(
      ({ decisionGraph, activeTab, viewConfig, hideLeftToolbar }) => {
        return {
          hasActiveNode: (decisionGraph?.nodes ?? []).some((node) => node.id === activeTab),
          viewConfig,
          hideLeftToolbar,
        };
      },
    );

    return (
      <>
        <ResolveUserEffect userResolver={userResolver} />
        {!hideLeftToolbar && <GraphSideToolbar />}
        <div className={'flex flex-1 flex-col gap-1 overflow-hidden bg-white'}>
          <GraphTabs disabled={disableTabs} tabBarExtraContent={tabBarExtraContent} />

          <Graph
            ref={ref}
            className={clsx([!hasActiveNode && !viewConfig?.enabled && 'flex flex-col', hasActiveNode && 'hidden'])}
            reactFlowProOptions={reactFlowProOptions}
            onDisableTabs={setDisableTabs}
          />
          <GraphNodes className={clsx([!hasActiveNode && viewConfig?.enabled && 'flex flex-col'])} />
          <TabContents customFunctions={customFunctions} />
        </div>
        <GraphPanel />
      </>
    );
  }),
);

const TabContents: React.FC<{ customFunctions?: any }> = React.memo(({ customFunctions }) => {
  const { openNodes, activeNodeId, components, user, customNodes } = useDecisionGraphState(
    ({ decisionGraph, openTabs, activeTab, components, user, customNodes }) => {
      const activeNodeId = (decisionGraph?.nodes ?? []).find((node) => node.id === activeTab)?.id;
      const openNodes = (decisionGraph?.nodes ?? []).filter((node) => openTabs.includes(node.id));

      return {
        openNodes: openNodes.map(({ id, type, content }) => ({
          id,
          type,
          kind: (content as { kind?: unknown } | undefined)?.kind,
        })),
        activeNodeId,
        components,
        user,
        customNodes,
      };
    },
  );

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ display: 'contents' }} ref={containerRef}>
      {openNodes.map((node) => (
        <div
          key={node?.id}
          className={clsx([
            'relative h-full w-full flex-1 min-h-0 bg-[var(--grl-color-bg-container)] outline-none focus:outline-none focus-within:outline-none',
            activeNodeId === node?.id ? 'flex flex-col' : 'hidden',
          ])}
        >
          {match(node?.type)
            .with(NodeKind.DecisionTable, () => decisionTableSpecification?.renderTab?.({ id: node?.id, user }))
            .with(NodeKind.Function, () => functionSpecification?.renderTab?.({ id: node?.id, user }))
            .with(NodeKind.Expression, () => expressionSpecification?.renderTab?.({ id: node?.id, user }))
            .with(NodeKind.Input, () => inputSpecification?.renderTab?.({ id: node?.id, user }))
            .with(NodeKind.Output, () => outputSpecification?.renderTab?.({ id: node?.id, user }))

            .otherwise(() => {
              const component = components.find((cmp) => cmp.type === node.type);
              if (component) {
                return component?.renderTab?.({ id: node.id, user, customFunctions });
              }

              const kind = (node as { kind?: unknown })?.kind;
              if (kind) {
                const customSpec = customNodes?.find((n) => n.kind === kind);
                if (customSpec?.renderTab) {
                  return customSpec.renderTab({ id: node.id, user, customFunctions });
                }
              }

              return null;
            })}
        </div>
      ))}
    </div>
  );
});
