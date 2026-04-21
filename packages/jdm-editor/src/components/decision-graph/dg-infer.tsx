import { VariableType } from '@gorules/zen-engine-wasm';
import equal from 'fast-deep-equal/es6/react';
import { produce } from 'immer';
import { useEffect } from 'react';
import { P, match } from 'ts-pattern';

import type { GraphWalker } from '../../helpers/traversal';
import { createGraphWalker } from '../../helpers/traversal';
import { isWasmAvailable, useWasmReady } from '../../helpers/wasm';
import type { DecisionGraphStoreType } from './context/dg-store.context';
import { NodeTypeKind, useDecisionGraphRaw } from './context/dg-store.context';
import type { NodeKind } from './nodes/specifications/specification-types';
import { nodeSpecification } from './nodes/specifications/specifications';

const shouldLogGraphInference = import.meta.env.DEV;
const shouldLogNodeInference = (nodeType?: string) =>
  nodeType === 'decisionTable' || nodeType === 'customNode' || nodeType === 'inputNode';

export const DecisionGraphInferTypes = () => {
  const { stateStore } = useDecisionGraphRaw();
  const wasmReady = useWasmReady();

  // Set variable types based on trace
  useEffect(() => {
    if (!wasmReady || !isWasmAvailable()) {
      return;
    }

    return stateStore.subscribe(({ simulate, nodeTypes, decisionGraph }, prevState) => {
      try {
        if (equal(simulate, prevState?.simulate)) {
          return;
        }

        const trace = match(simulate)
          .with({ result: P.nonNullable }, ({ result }) => result.trace)
          .otherwise(() => null);
        if (trace === null) {
          const newNodeTypes = produce(nodeTypes, (draft) => {
            Object.values(draft).forEach((nt) => {
              delete nt[NodeTypeKind.Input];
              delete nt[NodeTypeKind.Output];
            });
          });

          stateStore.setState({ nodeTypes: newNodeTypes });
          return;
        }

        const traceValues = Object.values(trace);
        if (traceValues.length === 0) {
          return;
        }

        const newNodeTypes = produce(nodeTypes, (draft) => {
          traceValues.forEach((t) => {
            const node = decisionGraph.nodes.find((n) => n.id === t.id);
            if (node?.type === 'inputNode') {
              return;
            }

            draft[t.id] ??= {};

            draft[t.id][NodeTypeKind.Output] = new VariableType(t.output ?? {});
            draft[t.id][NodeTypeKind.Input] = new VariableType(t.input ?? {});
          });
        });

        stateStore.setState({ nodeTypes: newNodeTypes });
      } catch (err) {
        console.error('error occurred while setting up variable types from trace', err);
      }
    });
  }, [stateStore, wasmReady]);

  // Infer types for nodes
  useEffect(() => {
    if (!wasmReady || !isWasmAvailable()) {
      return;
    }

    const graphWalker = createGraphWalker();
    return stateStore.subscribe((state, prevState) => {
      try {
        const stateDigest = inferTypesStateDigest(state);
        const prevStateDigest = inferTypesStateDigest(prevState);
        const needUpdate = inferTypesNeedsUpdate(state, prevState);
        if (equal(stateDigest, prevStateDigest) && !needUpdate) {
          return;
        }

        const infer = inferNodeTypes(state, prevState, graphWalker);
        if (infer.isModified) {
          stateStore.setState({ nodeTypes: infer.nodeTypes });
        }
      } catch (err) {
        console.error('error occurred during node type inference', err);
      }
    });
  }, [stateStore, wasmReady]);

  useEffect(() => {
    if (!wasmReady || !isWasmAvailable()) {
      return;
    }

    return stateStore.subscribe((state, prevState) => {
      try {
        const stateDigest = globalTypesStateDigest(state);
        const prevStateDigest = globalTypesStateDigest(prevState);
        if (equal(stateDigest, prevStateDigest)) {
          return;
        }

        const $nodesType = VariableType.fromJson({ Object: {} });
        state.decisionGraph.nodes.forEach((node) => {
          const nodeType = state.nodeTypes[node.id];
          const nodeOutput =
            nodeType?.[NodeTypeKind.Output] ??
            nodeType?.[NodeTypeKind.InferredOutput] ??
            VariableType.fromJson({ Object: {} });

          $nodesType.set(node.name, nodeOutput);
        });

        stateStore.setState({ globalType: { $nodes: $nodesType } });
      } catch (err) {
        console.error('error occurred while global node types', err);
      }
    });
  }, [stateStore, wasmReady]);

  return null;
};

type NodeTypes = DecisionGraphStoreType['state']['nodeTypes'];

type InferNodeTypes = (
  state: DecisionGraphStoreType['state'],
  prevState: DecisionGraphStoreType['state'],
  graphWalker: GraphWalker,
) => { nodeTypes: NodeTypes; isModified: boolean };

const inferNodeTypes: InferNodeTypes = ({ decisionGraph, nodeTypes, customNodes }, prevState, graphWalker) => {
  let isModified = false;
  const newNodeTypes = produce(nodeTypes, (draft) => {
    for (const { node, incomers } of graphWalker.walk(decisionGraph)) {
      const inferTypes =
        nodeSpecification[node.type as NodeKind]?.inferTypes ??
        customNodes.find((n) => n.kind === node.type)?.inferTypes;
      const prevContent = prevState.decisionGraph.nodes.find((n) => n.id === node.id)?.content;

      if (node.type === 'inputNode') {
        if (!inferTypes) {
          continue;
        }

        const inferredOutputType = inferTypes.determineOutputType({
          input: VariableType.fromJson({ Object: {} }),
          content: node.content,
        });
        const currentOutputType = draft?.[node.id]?.[NodeTypeKind.InferredOutput];
        const needsUpdate = inferTypes.needsUpdate(node.content, prevContent);
        if (!needsUpdate && currentOutputType) {
          continue;
        }

        if (!currentOutputType?.equal(inferredOutputType)) {
          isModified = true;
          draft[node.id] ??= {};
          draft[node.id][NodeTypeKind.InferredOutput] = inferredOutputType;

          if (shouldLogGraphInference && shouldLogNodeInference(node.type)) {
            console.log('[dg-infer] updated inferred output', {
              nodeId: node.id,
              nodeName: node.name,
              nodeType: node.type,
              inputType: {},
              inferredOutputType: inferredOutputType.toJson(),
            });
          }
        }

        continue;
      }

      const incomerInfos = incomers
        .map((inc) => {
          const type = draft[inc.id] ?? {};
          const outputType = type[NodeTypeKind.Output] ?? type[NodeTypeKind.InferredOutput];

          return {
            id: inc.id,
            name: inc.name,
            type: inc.type,
            outputType,
          };
        })
        .filter(
          (inc): inc is typeof inc & { outputType: VariableType } => !!inc.outputType,
        );
      const incomerTypes = incomerInfos.map((inc) => inc.outputType.clone());
      const inferredInputType = match(incomerTypes.length)
        .with(1, () => incomerTypes[0])
        .otherwise(() => VariableType.fromIncoming(incomerTypes));

      const currentInputType = draft?.[node.id]?.[NodeTypeKind.InferredInput];
      // Mutation block
      if (!currentInputType?.equal(inferredInputType)) {
        isModified = true;
        draft[node.id] ??= {};
        draft[node.id][NodeTypeKind.InferredInput] = inferredInputType;

        if (shouldLogGraphInference && shouldLogNodeInference(node.type)) {
          console.log('[dg-infer] updated inferred input', {
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            incomers: incomerInfos.map((inc) => ({
              id: inc.id,
              name: inc.name,
              type: inc.type,
              outputType: inc.outputType.toJson(),
            })),
            inferredInputType: inferredInputType.toJson(),
          });
        }
      }

      if (!inferTypes) {
        continue;
      }

      const input =
        draft?.[node.id]?.[NodeTypeKind.Input] ??
        draft?.[node.id]?.[NodeTypeKind.InferredInput] ??
        VariableType.fromJson('Any');

      const prevInput =
        prevState.nodeTypes?.[node.id]?.[NodeTypeKind.Input] ??
        prevState.nodeTypes?.[node.id]?.[NodeTypeKind.InferredInput] ??
        VariableType.fromJson('Any');

      const needsUpdate = inferTypes.needsUpdate(node.content, prevContent) || !input.equal(prevInput);
      if (!needsUpdate && draft?.[node.id]?.[NodeTypeKind.InferredOutput]) {
        continue;
      }

      const inferredOutputType = inferTypes.determineOutputType({ input, content: node.content });
      const currentOutputType = draft?.[node.id]?.[NodeTypeKind.InferredOutput];
      // Mutation block
      if (!currentOutputType?.equal(inferredOutputType)) {
        isModified = true;
        draft[node.id] ??= {};
        draft[node.id][NodeTypeKind.InferredOutput] = inferredOutputType;

        if (shouldLogGraphInference && shouldLogNodeInference(node.type)) {
          console.log('[dg-infer] updated inferred output', {
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            inputType: input.toJson(),
            inferredOutputType: inferredOutputType.toJson(),
          });
        }
      }
    }
  });

  return {
    isModified,
    nodeTypes: newNodeTypes,
  };
};

const inferTypesStateDigest = ({ decisionGraph, nodeTypes, customNodes }: DecisionGraphStoreType['state']) => {
  const edgesData = decisionGraph.edges;
  const nodesData = decisionGraph.nodes.map(({ id, type }) => ({ id, type }));
  const customNodesData = customNodes.map((cn) => cn.kind);

  const typesData = Object.entries(nodeTypes).map(([id, value]) => ({
    id,
    input: variableTypeHash(value[NodeTypeKind.Input]),
    output: variableTypeHash(value[NodeTypeKind.Output]),
  }));

  const inputNodeId = decisionGraph.nodes.find((n) => n.type === 'inputNode')?.id;
  const inputNodeType = match(nodeTypes?.[inputNodeId ?? '']?.[NodeTypeKind.InferredOutput])
    .with(P.nonNullable, (type) => type.hash())
    .otherwise(() => null);

  return { edgesData, nodesData, typesData, customNodesData, inputNodeType };
};

const inferTypesNeedsUpdate = (
  { decisionGraph, customNodes }: DecisionGraphStoreType['state'],
  prevState: DecisionGraphStoreType['state'],
) => {
  const nodesNeedUpdate = decisionGraph.nodes.map((node) => {
    const inferTypes =
      nodeSpecification[node.type as NodeKind]?.inferTypes ?? customNodes.find((n) => n.kind === node.type)?.inferTypes;

    if (!inferTypes) {
      return false;
    }

    const prevNode = prevState.decisionGraph.nodes.find((n) => n.id === node.id);
    if (!prevNode) {
      return true;
    }

    return inferTypes.needsUpdate(node.content, prevNode.content);
  });

  return nodesNeedUpdate.some((up) => up);
};

declare module '@gorules/zen-engine-wasm' {
  interface VariableType {
    __hash: string;
  }
}

const variableTypeHash = (vt?: VariableType): string | undefined => {
  if (!vt) {
    return undefined;
  }

  if (vt.__hash) {
    return vt.__hash;
  }

  vt.__hash = vt.hash();
  return vt.__hash;
};

const globalTypesStateDigest = (state: DecisionGraphStoreType['state']) => {
  const nodeInfo = state.decisionGraph.nodes.map((node) => {
    const nodeType = state.nodeTypes[node.id];
    const typ = nodeType?.[NodeTypeKind.Output] ?? nodeType?.[NodeTypeKind.InferredOutput];
    return {
      id: node.id,
      type: variableTypeHash(typ),
      name: node.name,
    };
  });

  return { nodeInfo };
};
