/**
 * 决策图(Decision Graph)状态管理上下文
 * 这个文件使用React Context和Zustand来管理决策图的状态和操作
 * 提供了决策图的数据结构定义、状态管理、以及各种操作方法
 */
import { type VariableType } from '@gorules/zen-engine-wasm';
import type { Monaco } from '@monaco-editor/react';
import equal from 'fast-deep-equal/es6/react';
import type { WritableDraft } from 'immer';
import { produce } from 'immer';
import React, { type MutableRefObject, createRef, useMemo } from 'react';
import type { EdgeChange, NodeChange, ReactFlowInstance, useEdgesState, useNodesState } from 'reactflow';
import { match } from 'ts-pattern';
import type { StoreApi, UseBoundStore } from 'zustand';
import { create } from 'zustand';

import type { CodeEditorProps } from '../../code-editor';
import type { DecisionEdge, DecisionGraphType, DecisionNode } from '../dg-types';
import { privateSymbol } from '../dg-types';
import { mapToGraphEdge, mapToGraphEdges, mapToGraphNode, mapToGraphNodes } from '../dg-util';
import type { useGraphClipboard } from '../hooks/use-graph-clipboard';
import type { CustomNodeSpecification } from '../nodes/custom-node';
import { NodeKind, type NodeSpecification } from '../nodes/specifications/specification-types';
import type { Simulation } from '../simulator/simulation.types';

/**
 * 面板类型定义
 * 用于侧边面板的配置
 */
export type PanelType = {
  id: string;               // 面板唯一标识符
  icon: React.ReactNode;    // 面板图标
  title: string;            // 面板标题
  renderPanel?: React.FC;   // 面板渲染函数
  hideHeader?: boolean;     // 是否隐藏面板头部
  onClick?: () => void;     // 点击面板的回调
};

/**
 * 用于immer的草稿更新回调类型
 * 允许在不可变更新中修改状态
 */
type DraftUpdateCallback<T> = (draft: WritableDraft<T>) => WritableDraft<T>;

/**
 * 视图配置权限类型
 * 定义用户对图形的不同编辑权限级别
 */
export type ViewConfigPermission = 'edit:values' | 'edit:rules' | 'edit:full';

/**
 * 视图配置
 * 控制决策图的可见性和权限
 */
export type ViewConfig = {
  enabled: boolean;                                               // 是否启用视图配置
  description?: string;                                           // 视图描述
  permissions?: Record<string, ViewConfigPermission | null | undefined> | null;  // 权限配置
};

/**
 * 节点类型种类枚举
 * 定义了节点可能的类型种类
 */
export enum NodeTypeKind {
  Input,          // 输入节点
  Output,         // 输出节点
  InferredInput,  // 推断的输入节点
  InferredOutput, // 推断的输出节点
}

/**
 * 设置决策图选项
 */
export type SetDecisionGraphOptions = {
  skipOnChangeEvent?: boolean;  // 是否跳过onChange事件触发
};

/**
 * 决策图存储类型
 * 包含状态、引用、操作和监听器四个部分
 */
export type DecisionGraphStoreType = {
  // 状态部分
  state: {
    id?: string;
    components: NodeSpecification[];
    disabled?: boolean;
    decisionGraph: DecisionGraphType;
    hoveredEdgeId: string | null;
    openTabs: string[];
    activeTab: string;
    configurable?: boolean;
    viewConfigCta?: string;
    viewConfig?: ViewConfig;

    name: string;                   // 图表名称

    customNodes: CustomNodeSpecification<object, any>[]; // 自定义节点列表

    panels?: PanelType[];           // 面板列表
    activePanel?: string;           // 当前活动面板
    onPanelsChange?: (val?: string) => void; // 面板变更回调

    simulate?: Simulation;
    simulatorOpen: boolean;
    simulatorRequest?: string;
    simulatorLoading: boolean;

    compactMode?: boolean;          // 是否启用紧凑模式

    nodeTypes: Record<string, Partial<Record<NodeTypeKind, VariableType>>>;  // 节点类型映射
    globalType: Record<string, VariableType>;  // 全局类型映射
  };

  // 引用部分 - 存储React Flow相关引用
  references: {
    nodesState: MutableRefObject<ReturnType<typeof useNodesState>>;      // 节点状态引用
    edgesState: MutableRefObject<ReturnType<typeof useEdgesState>>;      // 边状态引用
    reactFlowInstance: MutableRefObject<ReactFlowInstance | null>;       // ReactFlow实例引用
    graphClipboard: MutableRefObject<ReturnType<typeof useGraphClipboard>>; // 图形剪贴板引用
  };

  // 操作部分
  actions: {
    setDecisionGraph: (val: Partial<DecisionGraphType>, options?: SetDecisionGraphOptions) => void;  // 设置决策图

    handleNodesChange: (nodesChange: NodeChange[]) => void;    // 处理节点变更
    handleEdgesChange: (edgesChange: EdgeChange[]) => void;    // 处理边变更

    setNodes: (nodes: DecisionNode[]) => void;                // 设置所有节点
    addNodes: (nodes: DecisionNode[]) => void;                // 添加节点
    updateNode: (id: string, updater: DraftUpdateCallback<DecisionNode>) => void;  // 更新节点
    removeNodes: (ids: string[]) => void;                    // 删除节点

    duplicateNodes: (ids: string[]) => void;                 // 复制节点
    copyNodes: (ids: string[]) => void;                      // 复制节点到剪贴板
    pasteNodes: () => void;                                  // 从剪贴板粘贴节点

    setEdges: (edges: DecisionEdge[]) => void;               // 设置所有边
    addEdges: (edge: DecisionEdge[]) => void;                // 添加边
    removeEdges: (ids: string[]) => void;                    // 删除边
    removeEdgeByHandleId: (handleId: string) => void;        // 通过句柄ID删除边
    setHoveredEdgeId: (edgeId: string | null) => void;       // 设置悬停边ID

    closeTab: (id: string, action?: string) => void;         // 关闭标签页
    openTab: (id: string, name?: string, typeV3?: string) => void;
    goToNode: (id: string) => void;                          // 导航到节点

    setActivePanel: (panel?: string) => void;                // 设置活动面板
    
    setCompactMode: (mode: boolean) => void;                 // 设置紧凑模式
    toggleCompactMode: () => void;                           // 切换紧凑模式
    setSimulatorRequest: (req: string) => void;

    setNodeType: (id: string, kind: NodeTypeKind, vt: VariableType) => void;  // 设置节点类型
    removeNodeType: (id: string, kind?: NodeTypeKind) => void;                // 删除节点类型

    triggerNodeSelect: (id: string, mode: 'toggle' | 'only') => void;  // 触发节点选择
    handleEditorDomClick:(type: string, data: any) => void

  };

  // 监听器部分
  listeners: {
    onChange?: (val: DecisionGraphType) => void;                // 变更监听器
    onPanelsChange?: (val?: string) => void;                   // 面板变更监听器
    onReactFlowInit?: (instance: ReactFlowInstance) => void;   // ReactFlow初始化监听器
    onCodeExtension?: CodeEditorProps['extension'];            // 代码扩展监听器
    onFunctionReady?: (monaco: Monaco) => void;                // 函数准备好监听器
    onViewConfigCta?: () => void;                              // 视图配置行动召唤监听器
    onEventClickHandle?: (type: any, data: any) => void;
  };
};

/**
 * 暴露的存储类型
 * 扩展Zustand存储，添加setState方法
 */
export type ExposedStore<T> = UseBoundStore<StoreApi<T>> & {
  setState: (partial: Partial<T>) => void;
};

/**
 * 创建决策图上下文
 */
export const DecisionGraphStoreContext = React.createContext<{
  stateStore: ExposedStore<DecisionGraphStoreType['state']>;
  listenerStore: ExposedStore<DecisionGraphStoreType['listeners']>;
  referenceStore: ExposedStore<DecisionGraphStoreType['references']>;
  actions: DecisionGraphStoreType['actions'];
}>({} as any);

export type DecisionGraphContextProps = {
  //
};

/**
 * 决策图上下文提供者组件
 * 提供状态、引用、监听器和操作的上下文
 */
export const DecisionGraphProvider: React.FC<React.PropsWithChildren<DecisionGraphContextProps>> = (props) => {
  const { children } = props;

  // 创建状态存储
  const stateStore = useMemo(
    () =>
      create<DecisionGraphStoreType['state']>()(() => ({
        id: undefined,
        simulate: {},
        decisionGraph: { nodes: [], edges: [] },
        hoveredEdgeId: null,
        openTabs: [],
        activeTab: 'graph',
        name: 'graph.json',
        disabled: false,
        components: [],
        customNodes: [],
        activePanel: undefined,
        panels: [],
        compactMode: localStorage.getItem('jdm-compact-mode') === 'true',  // 从本地存储读取紧凑模式配置
        nodeTypes: {},
        globalType: {},
        simulatorLoading: false,
        simulatorOpen: false,
      })),
    [],
  );

  // 创建监听器存储
  const listenerStore = useMemo(
    () =>
      create<DecisionGraphStoreType['listeners']>(() => ({
        onChange: undefined,
        onPanelsChange: undefined,
        onEventClickHandle: undefined
      })),
    [],
  );

  // 创建引用存储
  const referenceStore = useMemo(
    () =>
      create<DecisionGraphStoreType['references']>(() => ({
        nodesState: createRef() as MutableRefObject<ReturnType<typeof useNodesState>>,
        edgesState: createRef() as MutableRefObject<ReturnType<typeof useEdgesState>>,
        graphClipboard: createRef() as MutableRefObject<ReturnType<typeof useGraphClipboard>>,
        reactFlowInstance: createRef() as MutableRefObject<ReactFlowInstance | null>,
      })),
    [],
  );

  // 定义所有操作方法
  const actions = useMemo<DecisionGraphStoreType['actions']>(
    () => ({
      setSimulatorRequest: (request: string) => {
        stateStore.setState({
          simulatorRequest: request,
        });
      },
      handleNodesChange: (changes = []) => {
        const { nodesState } = referenceStore.getState();
        const { decisionGraph } = stateStore.getState();
        const [, , onNodesChange] = nodesState.current;

        let hasChanges = false;

        onNodesChange?.(changes);
        const newDecisionGraph = produce(decisionGraph, (draft) => {
          changes.forEach((c) =>
            match(c)
              .with({ type: 'position' }, (p) => {
                const node = draft.nodes.find((n) => n.id === p.id);
                if (node && p.position && !equal(node.position, p.position)) {
                  hasChanges = true;
                  node.position = p.position;
                }
              })
              .with({ type: 'dimensions' }, (d) => {
                const node = draft.nodes.find((n) => n.id === d.id);
                if (node && !equal(node[privateSymbol]?.dimensions, d.dimensions)) {
                  hasChanges = true;
                  node[privateSymbol] ??= {};
                  node[privateSymbol].dimensions = { height: d.dimensions?.height, width: d.dimensions?.width };
                }
              })
              .with({ type: 'select' }, (s) => {
                const node = draft.nodes.find((n) => n.id === s.id);

                if (node && node[privateSymbol]?.selected !== s.selected) {
                  hasChanges = true;
                  node[privateSymbol] ??= {};
                  node[privateSymbol].selected = s.selected;
                }
              })
              .otherwise(() => {
                // 不做操作
              }),
          );
        });

        if (!hasChanges) {
          return;
        }

        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // 处理边变更
      handleEdgesChange: (changes = []) => {
        const { decisionGraph } = stateStore.getState();
        const { edgesState } = referenceStore.getState();

        edgesState?.current?.[2](changes);
        if (changes.find((c) => c.type === 'remove')) {
          const newDecisionGraph = produce(decisionGraph, (draft) => {
            const edges = (draft.edges || [])
              .map((edge) => {
                const change = changes.find((change) => 'id' in change && change.id === edge.id);
                if (change?.type === 'remove') {
                  return null;
                }
                return edge;
              })
              .filter((node) => !!node) as DecisionEdge[];
            draft.edges = edges;
          });

          stateStore.setState({ decisionGraph: newDecisionGraph });
          listenerStore.getState().onChange?.(newDecisionGraph);
        }
      },

      // 设置所有节点
      setNodes: (nodes: DecisionNode[] = []) => {
        const { nodesState } = referenceStore.getState();
        const { decisionGraph } = stateStore.getState();
        nodesState?.current?.[1](mapToGraphNodes(nodes));

        const newDecisionGraph = produce(decisionGraph, (draft) => {
          draft.nodes = nodes;
        });

        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // 添加节点
      addNodes: (nodes: DecisionNode[]) => {
        const { nodesState } = referenceStore.getState();
        const { decisionGraph } = stateStore.getState();

        // 检查是否已经有输入节点，如果有则过滤掉新增的输入节点
        const hasInput = nodesState.current[0]?.some((n) => n.type === NodeKind.Input);
        if (hasInput) {
          nodes = nodes.filter((n) => n.type !== NodeKind.Input);
        }

        nodesState.current[1]?.((n) => n.concat(mapToGraphNodes(nodes)));
        const newDecisionGraph = produce(decisionGraph, (draft) => {
          draft.nodes = (draft.nodes || []).concat(nodes);
        });

        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // 复制节点
      duplicateNodes: (ids) => {
        const { nodesState, edgesState } = referenceStore.getState();
        const { decisionGraph } = stateStore.getState();

        let nodes = (decisionGraph?.nodes || []).filter((n) => ids.includes(n.id));

        const hasInput = nodesState.current[0]?.some((n) => n.type === NodeKind.Input);
        if (hasInput) {
          nodes = nodes.filter((n) => n.type !== NodeKind.Input);
        }

        if (nodes.length === 0) {
          return;
        }

        // 创建新旧节点ID的映射关系
        const nodeIds: Record<string, string> = nodes.reduce(
          (acc, curr) => ({
            ...acc,
            [curr.id]: crypto.randomUUID(),
          }),
          {},
        );

        // 创建新节点，位置下移
        const newNodes = nodes.map<DecisionNode>((node) => ({
          ...node,
          id: nodeIds[node.id],
          position: {
            x: node.position?.x || 0,
            y: (node.position?.y || 0) + 140,
          },
        }));

        // 为新复制的节点创建边
        const oldNodeIds = Object.keys(nodeIds);
        const newEdges: DecisionEdge[] = [];

        if (newNodes.length > 0) {
          (edgesState.current?.[0] || []).forEach((edge) => {
            if (oldNodeIds.includes(edge.source) && oldNodeIds.includes(edge.target)) {
              newEdges.push({
                id: crypto.randomUUID(),
                type: edge.type,
                sourceId: nodeIds[edge.source],
                targetId: nodeIds[edge.target],
                sourceHandle: edge.sourceHandle ?? undefined,
                targetHandle: edge.targetHandle ?? undefined,
              });
            }
          });
        }

        // 更新图形状态
        nodesState.current[1]?.((n) => n.concat(newNodes.map(mapToGraphNode)));
        edgesState.current[1]?.((e) => e.concat(newEdges.map(mapToGraphEdge)));
        const newDecisionGraph = produce(decisionGraph, (draft) => {
          draft.nodes.push(...newNodes);
          draft.edges.push(...newEdges);
        });

        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // 复制节点到剪贴板
      copyNodes: (ids) => {
        const { graphClipboard, nodesState } = referenceStore.getState();
        if (!graphClipboard.current || !nodesState.current) {
          return;
        }

        const [nodes] = nodesState.current;
        const copyNodes = nodes.filter((n) => ids.includes(n.id));

        graphClipboard.current.copyNodes(copyNodes);
      },

      // 从剪贴板粘贴节点
      pasteNodes: () => {
        const { graphClipboard } = referenceStore.getState();
        graphClipboard.current?.pasteNodes?.();
      },

      // 删除节点
      removeNodes: (ids = []) => {
        const { nodesState, edgesState } = referenceStore.getState();
        const { decisionGraph, nodeTypes } = stateStore.getState();

        // 更新ReactFlow状态
        nodesState.current[1]?.((nodes) => nodes.filter((n) => ids.every((id) => n.id !== id)));
        edgesState.current[1]?.((edges) =>
          edges.filter((e) =>
            ids.every((id) => e.source !== id && e.target !== id && e.sourceHandle !== id && e.targetHandle !== id),
          ),
        );

        // 更新内部状态
        const newDecisionGraph = produce(decisionGraph, (draft) => {
          const nodes = draft.nodes || [];
          const edges = draft.edges || [];
          draft.nodes = nodes.filter((n) => ids.every((id) => n.id !== id));
          draft.edges = edges.filter((e) =>
            ids.every((id) => e.sourceId !== id && e.targetId !== id && e.sourceHandle !== id && e.targetHandle !== id),
          );
        });

        // 清理节点类型
        const newNodeTypes = produce(nodeTypes, (draft) => {
          ids.forEach((id) => {
            if (id in draft) {
              delete draft[id];
            }
          });
        });

        stateStore.setState({ decisionGraph: newDecisionGraph, nodeTypes: newNodeTypes });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // 添加边
      addEdges: (edges: DecisionEdge[]) => {
        const { edgesState } = referenceStore.getState();
        const { decisionGraph } = stateStore.getState();

        edgesState.current?.[1]?.((els) => els.concat(edges.map(mapToGraphEdge)));
        const newDecisionGraph = produce(decisionGraph, (draft) => {
          draft.edges = (draft.edges || []).concat(edges);
        });

        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // 设置所有边
      setEdges: (edges = []) => {
        const { edgesState } = referenceStore.getState();
        const { decisionGraph } = stateStore.getState();

        edgesState?.current?.[1]?.(mapToGraphEdges(edges));
        const newDecisionGraph = produce(decisionGraph, (draft) => {
          draft.edges = edges;
        });

        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // 删除边
      removeEdges: (ids) => {
        const { edgesState } = referenceStore.getState();
        const { decisionGraph } = stateStore.getState();

        edgesState?.current?.[1]?.((edges) => edges.filter((e) => !ids.find((id) => e.id === id)));
        const newDecisionGraph = produce(decisionGraph, (draft) => {
          draft.edges = draft.edges.filter((e) => !ids.find((id) => e.id === id));
        });

        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // 通过句柄ID删除边
      removeEdgeByHandleId: (handleId: string) => {
        if (!handleId) return;
        const { edgesState } = referenceStore.getState();
        const { decisionGraph } = stateStore.getState();
        edgesState?.current?.[1]?.((edges) => edges.filter((e) => e.sourceHandle !== handleId));
        const newDecisionGraph = produce(decisionGraph, (draft) => {
          draft.edges = draft.edges.filter((e) => e.sourceHandle !== handleId);
        });

        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // 更新节点
      updateNode: (id, updater) => {
        const { decisionGraph } = stateStore.getState();
        const { nodesState } = referenceStore.getState();
        const [nodes, setNodes] = nodesState.current;

        const newDecisionGraph = produce(decisionGraph, (draft) => {
          const node = (draft.nodes ?? []).find((node) => node?.id === id);
          if (!node) {
            return;
          }

          updater(node);
        });

        const changedNode = newDecisionGraph.nodes.find((n) => n.id === id);
        if (!changedNode) {
          return;
        }

        // 更新React Flow的节点
        const graphChangedNode = mapToGraphNode(changedNode as DecisionNode);
        const existingGraphNode = nodes.find((n) => n.id === id);
        if (!equal(graphChangedNode, existingGraphNode)) {
          setNodes((nodes) => nodes.map((n) => (n.id === id ? graphChangedNode : n)));
        }

        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // 设置决策图
      setDecisionGraph: (graph, options = {}) => {
        const { decisionGraph } = stateStore.getState();
        const { edgesState, nodesState } = referenceStore.getState();
        const { skipOnChangeEvent = false } = options;

        const newDecisionGraph = produce(decisionGraph, (draft) => {
          Object.assign(draft, graph);
        });

        edgesState?.current?.[1](mapToGraphEdges(newDecisionGraph?.edges ?? []));
        nodesState?.current?.[1](mapToGraphNodes(newDecisionGraph?.nodes ?? []));
        stateStore.setState({
          decisionGraph: newDecisionGraph,
        });
        if (!skipOnChangeEvent) {
          listenerStore.getState().onChange?.(newDecisionGraph);
        }
      },

      // 设置悬停边ID
      setHoveredEdgeId: (edgeId) => stateStore.setState({ hoveredEdgeId: edgeId }),
      
      // 导航到节点
      goToNode: (id: string) => {
        if (stateStore.getState().activeTab !== 'graph') {
          return;
        }

        const { reactFlowInstance } = referenceStore.getState();
        if (!reactFlowInstance.current) {
          return;
        }

        const node = reactFlowInstance.current.getNode(id);
        if (!node) {
          return;
        }

        // 使视图适应节点，进行动画过渡
        reactFlowInstance.current.fitView({ nodes: [node], duration: 1_000, maxZoom: 1.25 });
      },

      // 打开标签页
      openTab: (id: string, name?: string, typeV3?: string) => {
        const { openTabs } = stateStore.getState();
        const nodeId = openTabs.find((i) => i === id);

        if (id === 'graph') {
          return stateStore.setState({ activeTab: id });
        }

        if (nodeId) {
          stateStore.setState({ activeTab: nodeId });
        } else {
          stateStore.setState({ openTabs: [...openTabs, id], activeTab: id });
        }

        // 请求回调数据
        console.log('name', name);
        if(name){
          let type = name.split('_')[1] || typeV3
          switch (type) {
            case 'UDF':
                type = 'function'
              break;
            case 'NOTIFY':
                type = 'notify'
              break;
            case 'LIST':
              type = 'menu'
              break;
            default:
              type = type
              break;
          }
          const { onEventClickHandle } = listenerStore.getState();
          if (onEventClickHandle) {
            onEventClickHandle(type, '')
          }
        }
      },

      // 关闭标签页
      closeTab: (id: string, action?: string) => {
        const { openTabs, activeTab } = stateStore.getState();
        const index = openTabs?.findIndex((i) => i === id);
        const tab = openTabs?.[index];

        // 根据不同操作处理标签页关闭
        const updatedTabs = match(action)
          .with(undefined, () => openTabs.filter((id) => id !== tab))
          .with('close', () => openTabs.filter((id) => id !== tab))
          .with('close-all', () => [])
          .with('close-other', () => openTabs.filter((id) => id === tab))
          .with('close-right', () => openTabs.slice(0, index + 1))
          .with('close-left', () => openTabs.slice(index))
          .otherwise(() => openTabs);

        const updatedState: Partial<DecisionGraphStoreType['state']> = {
          openTabs: updatedTabs,
        };

        // 更新活动标签页
        const newActiveTabId = updatedTabs?.find((i) => i === activeTab);
        if (!newActiveTabId) {
          updatedState.activeTab = updatedTabs?.[index - 1] ?? 'graph';
        }

        stateStore.setState(updatedState);
      },

      // 设置活动面板
      setActivePanel: (panel?: string) => {
        const { panels } = stateStore.getState();
        const updatedState: Partial<DecisionGraphStoreType['state']> = {
          activePanel: panel === undefined ? undefined : (panels || []).find((p) => p.id === panel)?.id,
        };
        listenerStore.getState()?.onPanelsChange?.(panel);
        stateStore.setState(updatedState);
      },

      // 设置紧凑模式
      setCompactMode: (mode: boolean) => {
        const updatedState: Partial<DecisionGraphStoreType['state']> = {
          compactMode: mode,
        };
        localStorage.setItem('jdm-compact-mode', `${mode}`);  // 保存到本地存储
        stateStore.setState(updatedState);
      },

      // 切换紧凑模式
      toggleCompactMode: () => {
        const { compactMode } = stateStore.getState();
        const mode = !compactMode;
        const updatedState: Partial<DecisionGraphStoreType['state']> = {
          compactMode: mode,
        };
        localStorage.setItem('jdm-compact-mode', `${mode}`);  // 保存到本地存储
        stateStore.setState(updatedState);
      },

      // 设置节点类型
      setNodeType: (id, kind, vt) => {
        const { nodeTypes } = stateStore.getState();

        const newNodeTypes = produce(nodeTypes, (draft) => {
          draft[id] ??= {};
          draft[id][kind] = vt;
        });

        stateStore.setState({ nodeTypes: newNodeTypes });
      },

      // 删除节点类型
      removeNodeType: (id, kind) => {
        const { nodeTypes } = stateStore.getState();

        const newNodeTypes = produce(nodeTypes, (draft) => {
          if (!(id in draft)) {
            return;
          }

          if (kind) {
            if (kind in draft[id]) {
              delete draft[id][kind];
            }
          } else {
            delete draft[id];
          }
        });

        stateStore.setState({ nodeTypes: newNodeTypes });
      },

      // 触发节点选择
      triggerNodeSelect: (id, mode) => {
        const { decisionGraph } = stateStore.getState();
        const { nodesState, edgesState } = referenceStore.getState();
        const [, setNodes] = nodesState.current;
        const [, setEdges] = edgesState.current;

        const newDecisionGraph = produce(decisionGraph, (draft) => {
          const chosenNode = draft.nodes.find((n) => n.id === id);
          if (!chosenNode) {
            return;
          }

          // 如果是only模式，先取消所有节点的选中状态
          if (mode === 'only') {
            draft.nodes.forEach((n) => {
              if (n[privateSymbol]) {
                n[privateSymbol].selected = false;
              }
            });
          }

          // 设置目标节点的选中状态
          chosenNode[privateSymbol] ??= {};
          chosenNode[privateSymbol].selected = match(mode)
            .with('only', () => true)
            .otherwise(() => !chosenNode[privateSymbol]?.selected);
        });

        setNodes(mapToGraphNodes(newDecisionGraph.nodes));
        if (mode == 'only') {
          setEdges((edges) =>
            edges.map((e) => ({
              ...e,
              selected: false,
            })),
          );
        }
        stateStore.setState({ decisionGraph: newDecisionGraph });
        listenerStore.getState().onChange?.(newDecisionGraph);
      },

      // eventClik 和业务相关的点击事件
      handleEditorDomClick: (type: string, data: any) => {
        const { onEventClickHandle } = listenerStore.getState();
        if (onEventClickHandle) {
          onEventClickHandle(type, data)
        }
      }
    }),
    [],
  );

  // 合并所有值并提供给上下文
  const value = useMemo(
    () => ({
      stateStore,
      referenceStore,
      listenerStore,
      actions,
    }),
    [stateStore, referenceStore, listenerStore, actions],
  );

  return <DecisionGraphStoreContext.Provider value={value}>{children}</DecisionGraphStoreContext.Provider>;
};

/**
 * 使用决策图状态的钩子函数
 * 允许组件访问和订阅决策图状态
 * @param selector 选择器函数，从状态中选择需要的部分
 * @param equals 比较函数，用于决定是否重新渲染
 * @returns 选定的状态
 */
export function useDecisionGraphState<T>(
  selector: (state: DecisionGraphStoreType['state']) => T,
  equals: (a: any, b: any) => boolean = equal,
): T {
  return React.useContext(DecisionGraphStoreContext).stateStore(selector, equals);
}

/**
 * 使用决策图监听器的钩子函数
 * 允许组件访问和订阅决策图监听器
 * @param selector 选择器函数，从监听器中选择需要的部分
 * @param equals 比较函数，用于决定是否重新渲染
 * @returns 选定的监听器
 */
export function useDecisionGraphListeners<T>(
  selector: (state: DecisionGraphStoreType['listeners']) => T,
  equals: (a: any, b: any) => boolean = equal,
): T {
  return React.useContext(DecisionGraphStoreContext).listenerStore(selector, equals);
}

/**
 * 使用决策图引用的钩子函数
 * 允许组件访问和订阅决策图引用
 * @param selector 选择器函数，从引用中选择需要的部分
 * @param equals 比较函数，用于决定是否重新渲染
 * @returns 选定的引用
 */
export function useDecisionGraphReferences<T>(
  selector: (state: DecisionGraphStoreType['references']) => T,
  equals: (a: any, b: any) => boolean = equal,
): T {
  return React.useContext(DecisionGraphStoreContext).referenceStore(selector, equals);
}

/**
 * 使用决策图操作的钩子函数
 * 允许组件访问决策图操作方法
 * @returns 所有操作方法
 */
export function useDecisionGraphActions(): DecisionGraphStoreType['actions'] {
  return React.useContext(DecisionGraphStoreContext).actions;
}

/**
 * 使用原始决策图上下文的钩子函数
 * 获取完整的上下文对象（包含stateStore、referenceStore、listenerStore和actions）
 * @returns 完整上下文对象
 */
export function useDecisionGraphRaw() {
  return React.useContext(DecisionGraphStoreContext);
}

/**
 * 使用节点差异的钩子函数
 * 获取指定节点的差异信息
 * @param id 节点ID
 * @returns 节点和内容的差异信息
 */
export const useNodeDiff = (id: string) => {
  const { diff, contentDiff } = useDecisionGraphState((s) => {
    const node = (s?.decisionGraph?.nodes ?? []).find((node) => node.id === id);

    return {
      diff: node?._diff,
      contentDiff: node?.content?._diff,
    };
  });
  return {
    diff,
    contentDiff,
  };
};

/**
 * 使用边差异的钩子函数
 * 获取指定边的差异信息
 * @param id 边ID
 * @returns 边的差异信息
 */
export const useEdgeDiff = (id: string) => {
  const { diff } = useDecisionGraphState((s) => {
    const edge = (s?.decisionGraph?.edges ?? []).find((edge) => edge.id === id);

    return {
      diff: edge?._diff,
    };
  });
  return {
    diff,
  };
};

export default DecisionGraphProvider;
