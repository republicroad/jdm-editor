export * from './dg';

export type {
  NodeSpecification,
  MinimalNodeSpecification,
  MinimalNodeProps,
} from './nodes/specifications/specification-types';
export type { CustomNodeSpecification } from './nodes/custom-node/index';
export { createJdmNode } from './nodes/custom-node';
export { GraphNode, type GraphNodeProps } from './nodes/graph-node';
export {
  DecisionNode as GraphDecisionNode,
  type DecisionNodeProps as GraphDecisionNodeProps,
} from './nodes/decision-node';
export { GraphSimulator, type GraphSimulatorProps } from './simulator/dg-simulator';
export { SimulatorEditor } from './simulator/simulator-editor';
export {
  useDecisionGraphState,
  useDecisionGraphActions,
  useDecisionGraphReferences,
  useDecisionGraphListeners,
  useDecisionGraphRaw,
  useNodeDiff,
  useEdgeDiff,
  NodeTypeKind,
} from './context/dg-store.context';
export {
  useGraphSerializer,
  useTabSerializer,
  type DecisionGraphSnapshot,
  type TabSnapshot,
  type Slice,
} from './context/serializer.context';
export { NodeColor } from './nodes/specifications/colors';

export type {
  Simulation,
  SimulationTrace,
  SimulationTraceDataTable,
  SimulationTraceDataFunction,
  SimulationTraceDataExpression,
  SimulationError,
  SimulationOk,
  SimulationTraceDataSwitch,
} from './simulator/simulation.types';

export { nodeSpecification } from './nodes/specifications/specifications';

export { addStrikethrough, buildDiffString, compareAndUnifyLists, compareStringFields } from './diff/comparison';
export { calculateDiffGraph, processEdges, processNodes, type ProcessNodesOptions } from './diff/utility';

export { TabRequest, type TabRequestProps } from './graph/tab-request';
export { CustomFunctionTable, type TabCustomFunctionProps } from './graph/tab-custom-function-table';

export {
  type DecisionEdge,
  type DecisionNode,
  type DecisionGraphType,
  type DiffMetadata,
  type Diff,
  type Position,
  type DiffStatus,
} from './dg-types';

export {
  type RequestDefinition,
  type RequestDefinitionType,
  type RequestExampleSource,
  getRequestDefinitions,
  getRequestExampleSources,
  getRequestSchemaSourceValue,
  stringifyRequestSchemaValue,
  resolveRequestSchemaValue,
  buildRequestSchemaFromDefinitions,
  buildRequestExampleTemplateFromDefinitions,
  updateRequestSchemaExamples,
  normalizeRequestDefinitionOrders,
  normalizeRequestFieldKey,
  normalizeRequestJsonKeys,
} from '../../helpers/request-schema';

export {
  useSimulatorAutoSync,
  AUTO_SYNC_DEBOUNCE_MS,
  type UseSimulatorAutoSyncParams,
} from './simulator/use-simulator-auto-sync';

export { jsonSchemaToVariableType } from '../../helpers/json-schema';
