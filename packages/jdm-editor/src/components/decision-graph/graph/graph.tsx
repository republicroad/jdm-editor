import { CompressOutlined, LeftOutlined, RightOutlined, WarningOutlined } from '@/icons';
import type { Connection, Edge, Node, ProOptions, ReactFlowInstance, Viewport } from '@xyflow/react';
import {
  Background,
  ControlButton,
  Controls,
  ReactFlow,
  SelectionMode,
  getOutgoers,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import clsx from 'clsx';
import equal from 'fast-deep-equal';
import React, { type MutableRefObject, forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { App, Button, Typography } from '../../primitives';
import {
  type DecisionGraphStoreType,
  type ExposedStore,
  useDecisionGraphActions,
  useDecisionGraphListeners,
  useDecisionGraphRaw,
  useDecisionGraphReferences,
  useDecisionGraphState,
} from '../context/dg-store.context';
import { type DecisionGraphSnapshot, useSerializerRegistry } from '../context/serializer.context';
import { edgeFunction } from '../custom-edge';
import { mapToDecisionEdge } from '../dg-util';
import { useGraphClipboard } from '../hooks/use-graph-clipboard';
import { useGraphDnd } from '../hooks/use-graph-dnd';
import { componentsOpenedKey, useGraphSerializers } from '../hooks/use-graph-serializers';
import { useNodeAdd } from '../hooks/use-node-add';
import type { CustomNodeSpecification } from '../nodes/custom-node';
import { GraphNode } from '../nodes/graph-node';
import type { MinimalNodeProps } from '../nodes/specifications/specification-types';
import { NodeKind } from '../nodes/specifications/specification-types';
import { nodeSpecification } from '../nodes/specifications/specifications';
import { GraphComponents } from './graph-components';

export type GraphProps = {
  className?: string;
  onDisableTabs?: (val: boolean) => void;
  reactFlowProOptions?: ProOptions;
};

export type GraphRef = DecisionGraphStoreType['actions'] & {
  stateStore: ExposedStore<DecisionGraphStoreType['state']>;
  serialize: () => DecisionGraphSnapshot;
  restore: (snapshot: DecisionGraphSnapshot) => void;
};

const defaultNodeTypes = Object.entries(nodeSpecification).reduce(
  (acc, [key, value]) => ({
    ...acc,
    [key]: React.memo(
      (props: MinimalNodeProps) => value.renderNode({ specification: value, ...props }),
      (prevProps, nextProps) => {
        return (
          prevProps.id === nextProps.id &&
          prevProps.selected === nextProps.selected &&
          equal(prevProps.data, nextProps.data)
        );
      },
    ),
  }),
  {},
);

const edgeTypes = {
  edge: React.memo(edgeFunction(null)),
};

export const Graph = forwardRef<GraphRef, GraphProps>(function GraphInner({ reactFlowProOptions, className }, ref) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance>(null);

  const nodesState = useNodesState<Node>([]);
  const edgesState = useEdgesState<Edge>([]);

  const [componentsOpened, setComponentsOpened] = useState(() => {
    const localStorageKey = localStorage.getItem(componentsOpenedKey);
    if (!localStorageKey) {
      localStorage.setItem(componentsOpenedKey, 'true');
      return true;
    }
    return localStorage.getItem(componentsOpenedKey) === 'true';
  });

  const initialViewport = useRef<Viewport | undefined>(undefined);

  const raw = useDecisionGraphRaw();
  const registry = useSerializerRegistry();
  const graphActions = useDecisionGraphActions();
  const graphReferences = useDecisionGraphReferences((s) => s);
  const { onReactFlowInit } = useDecisionGraphListeners(({ onReactFlowInit }) => ({ onReactFlowInit }));
  const { modal } = App.useApp();
  const { disabled, hasInputNode, components, customNodes, id } = useDecisionGraphState(
    ({ id, disabled, components, customNodes, decisionGraph }) => ({
      id,
      disabled,
      components,
      customNodes,
      hasInputNode: (decisionGraph?.nodes || []).some((n) => n.type === NodeKind.Input),
    }),
  );

  graphReferences.nodesState.current = nodesState;
  graphReferences.edgesState.current = edgesState;
  graphReferences.graphClipboard.current = useGraphClipboard(reactFlowInstance, reactFlowWrapper);
  graphReferences.reactFlowInstance.current = reactFlowInstance.current;

  const customNodeRenderer = useMemo(() => {
    return React.memo(
      (props: MinimalNodeProps) => {
        const node = customNodes.find((node) => node.kind === props?.data?.kind) as CustomNodeSpecification<
          object,
          string
        >;

        if (!node) {
          console.warn('node not found', props, customNodes);
          return (
            <GraphNode
              id={props.id}
              specification={{
                displayName: `${props.data?.kind}`,
                color: 'var(--destructive)',
                icon: <WarningOutlined />,
              }}
              name={props?.data?.name}
              isSelected={props.selected}
              displayError
              noBodyPadding
              handleLeft={true}
              handleRight={true}
            />
          );
        }

        return node.renderNode({
          specification: node,
          ...props,
        });
      },
      (prevProps, nextProps) => {
        return (
          prevProps.id === nextProps.id &&
          prevProps.selected === nextProps.selected &&
          equal(prevProps.data, nextProps.data)
        );
      },
    );
  }, [customNodes]);

  const nodeTypes = useMemo<Record<string, React.FC<any>>>(() => {
    return components.reduce(
      (acc, component) => ({
        ...acc,
        [component.type]: React.memo(
          (props: MinimalNodeProps) => component.renderNode({ specification: component, ...props }),
          (prevProps, nextProps) => {
            return (
              prevProps.id === nextProps.id &&
              prevProps.selected === nextProps.selected &&
              equal(prevProps.data, nextProps.data)
            );
          },
        ),
      }),
      { ...defaultNodeTypes, customNode: customNodeRenderer },
    );
  }, [components, customNodeRenderer]);

  const addNodeInner = useNodeAdd({
    reactFlowWrapper,
    reactFlowInstance,
    customNodes,
    components,
    addNodes: graphActions.addNodes,
  });

  const isValidConnection = (connection: Connection | Edge): boolean => {
    // Disallow self-reference
    if (connection.source === connection.target) {
      return false;
    }

    if (disabled) {
      return false;
    }

    const [nodes] = nodesState;
    const [edges] = edgesState;

    const hasDuplicate = edges.some(
      (edge) =>
        edge.source === connection.source &&
        edge.target === connection.target &&
        (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
        (edge.targetHandle ?? null) === (connection.targetHandle ?? null),
    );

    const target = nodes.find((node) => node.id === connection.target);
    if (!target || target.id === connection.source) {
      return false;
    }

    const hasCycle = (node: Node, visited = new Set()) => {
      if (visited.has(node.id)) {
        return false;
      }

      visited.add(node.id);

      for (const outgoer of getOutgoers(node, nodes, edges)) {
        if (outgoer.id === connection.source) return true;
        if (hasCycle(outgoer, visited)) return true;
      }
    };

    return !hasDuplicate && !hasCycle(target);
  };

  const { onDrop, onDragOver } = useGraphDnd({
    reactFlowWrapper,
    reactFlowInstance,
    addNodes: graphActions.addNodes,
    addNode: addNodeInner,
  });

  const onConnect = (params: any) => {
    const edge = {
      ...params,
      type: 'edge',
      id: crypto.randomUUID(),
    };

    if (disabled) return;
    graphActions.addEdges([mapToDecisionEdge(edge)]);
  };

  useGraphSerializers({
    reactFlowInstance,
    onRestoreViewport: (viewport) => {
      initialViewport.current = viewport;
    },
    stateStore: raw.stateStore,
    componentsOpened,
    setComponentsOpened,
  });

  useImperativeHandle(ref, () => ({
    ...graphActions,
    stateStore: raw.stateStore,
    serialize: () => registry?.serialize() ?? {},
    restore: (snapshot) => registry?.restore(snapshot ?? {}),
  }));

  return (
    <div
      className={clsx([
        'relative h-full w-full flex-1 min-h-0 bg-[var(--grl-color-bg-container)] outline-none focus:outline-none focus-within:outline-none',
        className,
      ])}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'v' && e.metaKey && !disabled) {
          graphActions.pasteNodes();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
        }}
      >
        <div
          tabIndex={0}
          className={'h-full w-full flex-1 flex-row outline-none!'}
          onKeyDown={(e) => {
            const [nodes] = nodesState;
            const [edges] = edgesState;

            if (e.key === 'c' && e.metaKey) {
              const selectedNodeIds = nodesState[0].filter((n) => n.selected).map(({ id }) => id);
              if (selectedNodeIds.length === 0) {
                return;
              }

              graphActions.copyNodes(selectedNodeIds);
              e.preventDefault();
            } else if (e.key === 'd' && e.metaKey) {
              if (!disabled) {
                const selectedNodeIds = nodes.filter((n) => n.selected).map(({ id }) => id);
                if (selectedNodeIds.length === 0) {
                  return;
                }

                graphActions.duplicateNodes(selectedNodeIds);
              }
              e.preventDefault();
            } else if (e.key === 'Backspace') {
              if (!disabled) {
                const selectedNodes = nodes.filter((n) => n.selected);
                const selectedEdges = edges.filter((e) => e.selected);

                if (selectedNodes.length > 0) {
                  const length = selectedNodes.length;
                  const text = length > 1 ? 'nodes' : 'node';
                  modal.confirm({
                    icon: null,
                    title: `Delete ${text}`,
                    content: (
                      <Typography.Text>
                        Are you sure you want to delete {length > 1 ? `${length} ${text}` : text}?
                      </Typography.Text>
                    ),
                    okButtonProps: { danger: true },
                    onOk: () => {
                      if (selectedEdges.length > 0) {
                        graphActions.removeEdges(selectedEdges.map((e) => e.id));
                      }
                      graphActions.removeNodes(selectedNodes.map((n) => n.id));
                    },
                  });
                } else if (selectedEdges.length > 0) {
                  graphActions.removeEdges(selectedEdges.map((e) => e.id));
                }
              }
              e.stopPropagation();
              e.preventDefault();
            }
          }}
        >
          <div className={clsx(['react-flow'])} ref={reactFlowWrapper}>
            <ReactFlow
              deleteKeyCode={null}
              elevateEdgesOnSelect={false}
              elevateNodesOnSelect={true}
              zoomOnDoubleClick={false}
              connectionRadius={35}
              nodes={nodesState[0]}
              edges={edgesState[0]}
              defaultViewport={initialViewport.current}
              fitView={!initialViewport.current}
              fitViewOptions={{ padding: 0.15 }}
              onInit={(instance) => {
                (reactFlowInstance as MutableRefObject<ReactFlowInstance>).current = instance;
                if (initialViewport.current) {
                  instance.setViewport(initialViewport.current);
                }
                onReactFlowInit?.(instance);
              }}
              snapToGrid={true}
              snapGrid={[5, 5]}
              minZoom={0.25}
              selectionMode={SelectionMode.Partial}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              proOptions={reactFlowProOptions}
              nodesConnectable={!disabled}
              nodesDraggable={!disabled}
              edgesReconnectable={!disabled}
              onNodesChange={graphActions.handleNodesChange}
              onEdgesChange={graphActions.handleEdgesChange}
              onNodesDelete={(e) => {
                e.forEach((node) => {
                  graphActions.closeTab(node?.id);
                });
              }}
              onEdgeMouseEnter={(_, edge) => graphActions.setHoveredEdgeId(edge.id)}
              onEdgeMouseLeave={() => graphActions.setHoveredEdgeId(null)}
            >
              <Controls showInteractive={false}>
                <ControlButton onClick={() => graphActions.toggleCompactMode()}>
                  <CompressOutlined />
                </ControlButton>
              </Controls>
              <Background id={id} color='var(--border)' gap={20} />
            </ReactFlow>
          </div>
        </div>
        {!disabled && (
          <div
            className={clsx(
              'flex h-full min-h-0 flex-col border-l border-l-[var(--border)] bg-[var(--grl-color-bg-container)]',
              !componentsOpened ? 'w-10 min-w-10' : 'w-[260px] min-w-[260px]',
            )}
          >
            <div className='box-border flex flex-row items-center border-b border-b-[var(--border)] bg-[var(--grl-color-primary-bg-fade)] px-3 py-1.5'>
              {componentsOpened && (
                <div className='flex flex-1 items-center'>
                  <Typography.Text strong style={{ marginBottom: 0 }}>
                    Components
                  </Typography.Text>{' '}
                  <Typography.Text type='secondary' style={{ fontSize: 10, marginLeft: 5 }}>
                    (Drag-and-drop)
                  </Typography.Text>
                </div>
              )}
              <Button
                type={'text'}
                size='small'
                icon={
                  componentsOpened ? (
                    <RightOutlined style={{ fontSize: 12 }} />
                  ) : (
                    <LeftOutlined style={{ fontSize: 12 }} />
                  )
                }
                onClick={() => {
                  const value = !componentsOpened;
                  setComponentsOpened(!componentsOpened);
                  localStorage.setItem(componentsOpenedKey, `${value}`);
                }}
              />
            </div>
            <div className='min-h-0 flex-1 overflow-y-auto'>
              <GraphComponents inputDisabled={hasInputNode} collapsed={!componentsOpened} disabled={disabled} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
