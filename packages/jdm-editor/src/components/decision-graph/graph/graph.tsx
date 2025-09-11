/**
 * 决策图编辑器组件
 * 
 * 基于ReactFlow的图形编辑器，用于创建和管理决策流程图。
 * 支持拖放组件、连接节点和编辑图形结构。
 */
import { CloseOutlined, CompressOutlined, LeftOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Modal, Tooltip, Typography, message, notification } from 'antd';
import clsx from 'clsx';
import equal from 'fast-deep-equal';
import React, { type MutableRefObject, forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Connection, Node, ProOptions, ReactFlowInstance, XYPosition } from 'reactflow';
import ReactFlow, {
  Background,
  ControlButton,
  Controls,
  SelectionMode,
  getOutgoers,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { P, match } from 'ts-pattern';

import { nodeSchema } from '../../../helpers/schema';
import {
  type DecisionGraphStoreType,
  type ExposedStore,
  useDecisionGraphActions,
  useDecisionGraphListeners,
  useDecisionGraphRaw,
  useDecisionGraphReferences,
  useDecisionGraphState,
} from '../context/dg-store.context';
import { edgeFunction } from '../custom-edge';
import { type DecisionNode } from '../dg-types';
import { mapToDecisionEdge } from '../dg-util';
import '../dg.scss';
import { useGraphClipboard } from '../hooks/use-graph-clipboard';
import type { CustomNodeSpecification } from '../nodes/custom-node';
import { GraphNode } from '../nodes/graph-node';
import type { MinimalNodeProps } from '../nodes/specifications/specification-types';
import { NodeKind } from '../nodes/specifications/specification-types';
import { nodeSpecification } from '../nodes/specifications/specifications';
import { GraphComponents } from './graph-components';

/**
 * Graph组件的属性
 */
export type GraphProps = {
  className?: string;
  onDisableTabs?: (val: boolean) => void;
  reactFlowProOptions?: ProOptions;
  userId?: string;
  projectId?: string | null;
  menuList?: any;
  customFunctions?: any;
};

/**
 * Graph组件的引用类型，暴露动作和状态存储
 */
export type GraphRef = DecisionGraphStoreType['actions'] & {
  stateStore: ExposedStore<DecisionGraphStoreType['state']>;
};

/**
 * 自定义边类型配置
 */
const edgeTypes = {
  edge: React.memo(edgeFunction(null)),
};

/**
 * Graph组件的主要实现
 * 提供决策图编辑器的核心功能
 */
export const Graph = forwardRef<GraphRef, GraphProps>(function GraphInner({ reactFlowProOptions, className, userId, projectId, menuList, customFunctions }, ref) {
  // DOM元素和ReactFlow实例的引用
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance>(null);

  // 使用ReactFlow hooks管理节点和边的状态
  const nodesState = useNodesState([]);
  const edgesState = useEdgesState([]);

  // 组件面板的UI状态
  const [componentsOpened, setComponentsOpened] = useState(true);

  // 访问决策图存储和动作
  const raw = useDecisionGraphRaw();
  const graphActions = useDecisionGraphActions();
  const graphReferences = useDecisionGraphReferences((s) => s);
  const { onReactFlowInit } = useDecisionGraphListeners(({ onReactFlowInit }) => ({ onReactFlowInit }));
  const { disabled, hasInputNode, components, customNodes } = useDecisionGraphState(
    ({ disabled, components, customNodes, decisionGraph }) => ({
      disabled,
      components,
      customNodes,
      hasInputNode: (decisionGraph?.nodes || []).some((n) => n.type === NodeKind.Input),
    }),
  );

  // 更新对当前状态和实例的引用
  graphReferences.nodesState.current = nodesState;
  graphReferences.edgesState.current = edgesState;
  graphReferences.graphClipboard.current = useGraphClipboard(reactFlowInstance, reactFlowWrapper);
  graphReferences.reactFlowInstance.current = reactFlowInstance.current;

  /**
   * 用户定义节点类型的自定义渲染器
   * 使用React.memo进行性能优化
   */
  const customNodeRenderer = useMemo(() => {
    return React.memo(
      (props: MinimalNodeProps) => {
        // 根据kind查找自定义节点规格
        const node = customNodes.find((node) => node.kind === props?.data?.kind) as CustomNodeSpecification<
          object,
          string
        >;

        // 如果找不到匹配的规格，渲染错误节点
        if (!node) {
          console.warn('node not found', props, customNodes);
          return (
            <GraphNode
              id={props.id}
              specification={{
                displayName: `${props.data?.kind}`,
                color: 'var(--grl-color-error)',
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

        // 使用其规格渲染自定义节点
        return node.renderNode({
          specification: node,
          ...props,
        });
      },
      (prevProps, nextProps) => {
        // 自定义相等性检查，防止不必要的重新渲染
        return (
          prevProps.id === nextProps.id &&
          prevProps.selected === nextProps.selected &&
          equal(prevProps.data, nextProps.data)
        );
      },
    );
  }, [customNodes]);

  /**
 * 通过映射nodeSpecification创建默认节点类型
 * 每种节点类型都用React.memo包装以优化性能
 */
const defaultNodeTypes = Object.entries(nodeSpecification).reduce(
  (acc, [key, value]) => ({
    ...acc,
    [key]: React.memo(
      (props: MinimalNodeProps) => value.renderNode({ specification: value, ...props,customNodes: customNodes }),
      (prevProps, nextProps) => {
        // 自定义相等性检查，防止不必要的重新渲染
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

  /**
   * 组合节点类型，包括默认节点、组件和自定义节点
   * 当components或customNodeRenderer更改时重新计算
   */
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
      // { ...defaultNodeTypes, customNode: customNodeRenderer },
      { ...defaultNodeTypes},

    );
  // }, [components, customNodeRenderer]);
  }, [components]);

  /**
   * 向图中添加新节点
   * @param type 节点类型标识符
   * @param position 节点位置（可选）
   * @param component 自定义节点的组件标识符（可选）
   * @returns 当节点添加完成时解析的Promise
   */
  const addNodeInner = async (type: string, position?: XYPosition, component?: string) => {
    // 检查ReactFlow是否已初始化
    if (!reactFlowWrapper.current || !reactFlowInstance.current) {
      return;
    }

    // 如果未指定位置，则计算中心位置
    if (!position) {
      const rect = reactFlowWrapper.current.getBoundingClientRect();
      const rectCenter = {
        x: rect.width / 2,
        y: rect.height / 2,
      };

      position = reactFlowInstance.current.project(rectCenter);
    }

    // 根据类型和组件查找节点规格
    const customSpecification = match(type)
      .with('customNode', () => {
        let custom = customNodes.find((node) => node.kind === component)
        console.log('customNodes', customNodes);
        const allSpecifications = [...Object.values(nodeSpecification), ...components];
        let middle = allSpecifications.find((s) => s.type === type) || {};
        Object.assign(middle, { icon: custom?.icon });
        return middle;
      })
      .otherwise(() => {
        const allSpecifications = [...Object.values(nodeSpecification), ...components];
        return allSpecifications.find((s) => s.type === type);
      });
    if (!customSpecification) {
      message.error(`Unknown node type ${type} - ${component}.`);
      return;
    }

    // 根据规格类型创建新节点
    let newNode: DecisionNode | null = match(customSpecification)
      .with({ type: 'customNode' }, (specification) => {
        // 处理自定义节点类型
        const existingCount =
          (reactFlowInstance.current?.getNodes() || []).filter((n) => n.type === specification.type).length + 1;
        const partialNode = specification.generateNode({ component: component || 'customNode',index: existingCount });
        
          return {
            id: crypto.randomUUID(),
            type: 'customNode',
            name: partialNode.name,
            position: position as XYPosition,
            content: {
              kind: component,
              config: {
                ...(partialNode as any)?.content?.config,
                meta: {
                  ...(partialNode as any)?.config?.content?.meta,
                  user: userId,
                  proj: projectId,
                },
              },
            },
          } satisfies DecisionNode;
      })
      .with({ type: P.string }, (specification) => {
        // 处理带有type属性的标准节点
        const existingCount =
          (reactFlowInstance.current?.getNodes() || []).filter((n) => n.type === specification.type).length + 1;
        const partialNode = specification.generateNode({ index: existingCount });

        return {
          id: crypto.randomUUID(),
          type: specification.type,
          position: position as XYPosition,
          ...partialNode,
        } satisfies DecisionNode;
      })
      .otherwise(() => null);
    if (!newNode) {
      message.error(`Unknown node type ${type} - ${component}.`);
      return;
    }

    // 如果可用，执行onNodeAdd钩子
    if (customSpecification.onNodeAdd) {
      try {
        newNode = (await customSpecification.onNodeAdd(newNode as any)) as any;
      } catch {
        return;
      }
    }

    // 验证节点结构并添加到图中
    const parsed = nodeSchema.safeParse(newNode);
    if (parsed.success) {
      return graphActions.addNodes([nodeSchema.parse(newNode)]);
    }
    message.error(parsed.error?.message);
  };

  /**
   * 验证节点之间的连接是否有效
   * 防止自连接、重复连接和循环连接
   * @param connection 要验证的连接
   * @returns 表示连接是否有效的布尔值
   */
  const isValidConnection = (connection: Connection): boolean => {
    // 禁止自引用
    if (connection.source === connection.target) {
      return false;
    }

    // 当图表被禁用时阻止连接
    if (disabled) {
      return false;
    }

    const [nodes] = nodesState;
    const [edges] = edgesState;

    // 检查是否有重复连接
    const hasDuplicate = edges.some(
      (edge) =>
        edge.source === connection.source &&
        edge.target === connection.target &&
        (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
        (edge.targetHandle ?? null) === (connection.targetHandle ?? null),
    );

    // 验证目标节点是否存在且不同于源节点
    const target = nodes.find((node) => node.id === connection.target);
    if (!target || target.id === connection.source) {
      return false;
    }

    // 递归函数，用于检测图中的循环
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

  /**
   * 处理将节点拖放到图上的事件
   * @param event 拖拽事件
   */
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!reactFlowWrapper.current || !reactFlowInstance.current) {
      return;
    }

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    let elementPosition: XYPosition;

    // 从拖拽数据中获取相对位置
    try {
      elementPosition = JSON.parse(event.dataTransfer.getData('relativePosition'));
    } catch {
      return;
    }

    // 计算流程图坐标中的位置
    const position = reactFlowInstance.current.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    }) as XYPosition;

    // 根据元素的内部偏移调整位置
    position.x -= Math.round((elementPosition.x * 226) / 10) * 10;
    position.y -= Math.round((elementPosition.y * 60) / 10) * 10;

    // 检查是否拖拽的是预配置节点
    const nodeData = event.dataTransfer.getData('nodeData');
    if (nodeData) {
      try {
        const jsonData = JSON.parse(nodeData);
        graphActions.addNodes([nodeSchema.parse({ ...jsonData, position })]);
      } catch (err) {
        notification.error({ message: 'Failed to create a node' });
        console.error(err);
      }

      return;
    }

    // 否则创建指定类型的新节点
    const type = event.dataTransfer.getData('nodeType');
    const component = match(event.dataTransfer.getData('customNodeComponent'))
      .with(P.string, (c) => c)
      .otherwise(() => undefined);

    void addNodeInner(type, position, component);
  };

  /**
   * 处理拖放操作的拖动悬停事件
   */
  const onDragOver = (event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  /**
   * 处理节点之间的连接创建
   */
  const onConnect = (params: any) => {
    const edge = {
      ...params,
      type: 'edge',
      id: crypto.randomUUID(),
    };

    if (disabled) return;
    graphActions.addEdges([mapToDecisionEdge(edge)]);
  };

  // 通过ref暴露动作和状态存储
  useImperativeHandle(ref, () => ({
    ...graphActions,
    stateStore: raw.stateStore,
  }));

  return (
    <div
      className={clsx(['tab-content', className])}
      tabIndex={0}
      onKeyDown={(e) => {
        // 处理粘贴快捷键
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
        {/* 折叠的组件面板切换按钮 */}
        {!disabled && !componentsOpened && (
          <div
            className={'grl-dg__components__floating'}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
            }}
          >
            <Tooltip placement='right' title='组件'>
              <Button icon={<LeftOutlined style={{ fontSize: 12 }} />} onClick={() => setComponentsOpened(true)} />
            </Tooltip>
          </div>
        )}
        <div
          tabIndex={0}
          className={'content-wrapper'}
          onKeyDown={(e) => {
            const [nodes] = nodesState;
            const [edges] = edgesState;

            // 处理复制、复制和删除操作的键盘快捷键
            if (e.key === 'c' && e.metaKey) {
              // 复制选中的节点
              const selectedNodeIds = nodesState[0].filter((n) => n.selected).map(({ id }) => id);
              if (selectedNodeIds.length === 0) {
                return;
              }

              graphActions.copyNodes(selectedNodeIds);
              e.preventDefault();
            } else if (e.key === 'd' && e.metaKey) {
              // 复制选中的节点
              if (!disabled) {
                const selectedNodeIds = nodes.filter((n) => n.selected).map(({ id }) => id);
                if (selectedNodeIds.length === 0) {
                  return;
                }

                graphActions.duplicateNodes(selectedNodeIds);
              }
              e.preventDefault();
            } else if (e.key === 'Backspace') {
              // 删除选中的节点或边
              if (!disabled) {
                const selectedNodes = nodes.filter((n) => n.selected);
                const selectedEdges = edges.filter((e) => e.selected);

                if (selectedNodes.length > 0) {
                  // 显示节点删除确认对话框
                  const length = selectedNodes.length;
                  const text = length > 1 ? 'nodes' : 'node';
                  Modal.confirm({
                    icon: null,
                    title: `删除节点`,
                    content: (
                      <Typography.Text>
                        确定要删除节点吗?
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
                  // 无需确认直接删除选中的边
                  graphActions.removeEdges(selectedEdges.map((e) => e.id));
                }
              }
              e.stopPropagation();
              e.preventDefault();
            }
          }}
        >
          {/* 主ReactFlow容器 */}
          <div className={clsx(['react-flow'])} ref={reactFlowWrapper}>
            <ReactFlow
              deleteKeyCode={null} // 禁用默认的删除键处理
              elevateEdgesOnSelect={false}
              elevateNodesOnSelect={true}
              zoomOnDoubleClick={false}
              connectionRadius={35}
              nodes={nodesState[0]}
              edges={edgesState[0]}
              onInit={(instance) => {
                (reactFlowInstance as MutableRefObject<ReactFlowInstance>).current = instance;
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
              edgesUpdatable={!disabled}
              onNodesChange={graphActions.handleNodesChange}
              onEdgesChange={graphActions.handleEdgesChange}
              onNodesDelete={(e) => {
                // 当节点被删除时关闭相关的标签页
                e.forEach((node) => {
                  graphActions.closeTab(node?.id);
                });
              }}
              onEdgeMouseEnter={(_, edge) => graphActions.setHoveredEdgeId(edge.id)}
              onEdgeMouseLeave={() => graphActions.setHoveredEdgeId(null)}
            >
              {/* 图表控制按钮 */}
              <Controls showInteractive={false}>
                <ControlButton onClick={() => graphActions.toggleCompactMode()}>
                  <CompressOutlined />
                </ControlButton>
              </Controls>
              <Background color='var(--grl-color-border)' gap={20} />
            </ReactFlow>
          </div>
        </div>
        {/* 组件面板 - 启用时可见 */}
        {!disabled && componentsOpened && (
          <div className={'grl-dg__aside__menu'}>
            <div className={'grl-dg__aside__menu__heading'}>
              <div className={'grl-dg__aside__menu__heading__text'}>
                <Typography.Text strong style={{ marginBottom: 0 }}>
                  组件
                </Typography.Text>{' '}
                <Typography.Text type='secondary' style={{ fontSize: 10, marginLeft: 5 }}>
                  (拖放操作)
                </Typography.Text>
              </div>
              <Button
                type={'text'}
                size='small'
                icon={<CloseOutlined style={{ fontSize: 12 }} />}
                onClick={() => setComponentsOpened(false)}
              />
            </div>
            <div className={'grl-dg__aside__menu__content'}>
              <GraphComponents inputDisabled={hasInputNode} disabled={disabled} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
