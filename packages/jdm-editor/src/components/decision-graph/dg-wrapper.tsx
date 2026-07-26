import clsx from 'clsx';
import { createDragDropManager } from 'dnd-core';
import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { ProOptions } from 'reactflow';
import 'reactflow/dist/style.css';
import { match } from 'ts-pattern';

import { useDecisionGraphRaw, useDecisionGraphState } from './context/dg-store.context';
import { GraphPanel } from './dg-panel';
import './dg.scss';
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
import { NodeKind, type NodeSpecification } from './nodes/specifications/specification-types';

export type DecisionGraphWrapperProps = {
  reactFlowProOptions?: ProOptions;
  tabBarExtraContent?: GraphTabsProps['tabBarExtraContent'];
  userResolver?: UserResolver;
};

const ResolveUserEffect: React.FC<{ userResolver?: UserResolver }> = ({ userResolver }) => {
  const { stateStore } = useDecisionGraphRaw();

  useEffect(() => {
    if (!userResolver) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await userResolver();
        if (!cancelled && result) {
          stateStore.setState({
            user: result.user ?? '',
          });
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
    { reactFlowProOptions, tabBarExtraContent, userResolver },
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
        <div className={'grl-dg__graph'}>
          <GraphTabs disabled={disableTabs} tabBarExtraContent={tabBarExtraContent} />

          <Graph
            ref={ref}
            className={clsx([!hasActiveNode && !viewConfig?.enabled && 'active'])}
            reactFlowProOptions={reactFlowProOptions}
            onDisableTabs={setDisableTabs}
          />
          <GraphNodes className={clsx([!hasActiveNode && viewConfig?.enabled && 'active'])} />
          <TabContents />
        </div>
        <GraphPanel />
      </>
    );
  }),
);

const TabContents: React.FC = React.memo(() => {
  const { openNodes, activeNodeId, components, user, customNodes } = useDecisionGraphState(
    ({ decisionGraph, openTabs, activeTab, components, user, customNodes }) => {
      const activeNodeId = (decisionGraph?.nodes ?? []).find((node) => node.id === activeTab)?.id;
      const openNodes = (decisionGraph?.nodes ?? []).filter((node) => openTabs.includes(node.id));

      return {
        openNodes: openNodes.map(({ id, type }) => ({ id, type })),
        activeNodeId,
        components,
        user,
        customNodes,
      };
    },
  );

  const specOverrides = useMemo(() => {
    return components?.reduce(
      (acc, c) => ({ ...acc, [c.type]: c }),
      {} as Record<string, NodeSpecification>,
    ) ?? {};
  }, [components]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dndManager = useMemo(() => {
    return createDragDropManager(HTML5Backend, undefined, {
      rootElement: containerRef.current,
    });
  }, [containerRef.current]);

  return (
    <div style={{ display: 'contents' }} ref={containerRef}>
      {openNodes.map((node) => (
        <div key={node?.id} className={clsx(['tab-content', activeNodeId === node?.id && 'active'])}>
          {match(node?.type)
            .with(NodeKind.DecisionTable, () =>
              specOverrides[NodeKind.DecisionTable]?.renderTab?.({ id: node?.id, manager: dndManager, user })
                ?? decisionTableSpecification?.renderTab?.({ id: node?.id, manager: dndManager, user }),
            )
            .with(NodeKind.Function, () =>
              specOverrides[NodeKind.Function]?.renderTab?.({ id: node?.id, manager: dndManager, user })
                ?? functionSpecification?.renderTab?.({ id: node?.id, manager: dndManager, user }),
            )
            .with(NodeKind.Expression, () =>
              specOverrides[NodeKind.Expression]?.renderTab?.({ id: node?.id, manager: dndManager, user })
                ?? expressionSpecification?.renderTab?.({ id: node?.id, manager: dndManager, user }),
            )
            .with(NodeKind.Input, () =>
              specOverrides[NodeKind.Input]?.renderTab?.({ id: node?.id, manager: dndManager, user })
                ?? inputSpecification?.renderTab?.({ id: node?.id, manager: dndManager, user }),
            )
            .with(NodeKind.Output, () =>
              specOverrides[NodeKind.Output]?.renderTab?.({ id: node?.id, manager: dndManager, user })
                ?? outputSpecification?.renderTab?.({ id: node?.id, manager: dndManager, user }),
            )
            .otherwise(() => {
              const kind = (node as any)?.content?.kind;
              if (kind) {
                const customSpec = customNodes?.find((n) => n.kind === kind);
                if (customSpec?.renderTab) {
                  return customSpec.renderTab({ id: node.id, manager: dndManager, user });
                }
              }

              const component = components.find((cmp) => cmp.type === node.type);
              if (component) {
                return component?.renderTab?.({ id: node.id, manager: dndManager, user });
              }

              return null;
            })}
        </div>
      ))}
    </div>
  );
});
