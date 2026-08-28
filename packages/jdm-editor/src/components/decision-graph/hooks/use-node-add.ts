import type { ReactFlowInstance, XYPosition } from '@xyflow/react';
import type { MutableRefObject } from 'react';
import { toast } from 'sonner';
import { P, match } from 'ts-pattern';

import { nodeSchema } from '../../../helpers/schema';
import type { DecisionGraphStoreType } from '../context/dg-store.context';
import type { DecisionNode } from '../dg-types';
import type { CustomNodeSpecification } from '../nodes/custom-node';
import type { NodeSpecification } from '../nodes/specifications/specification-types';
import { nodeSpecification } from '../nodes/specifications/specifications';

/**
 * Node-creation pipeline shared by palette drops and programmatic adds:
 * resolve the specification, generate the node, run optional onNodeAdd,
 * validate against the schema and commit to the store.
 */
export const useNodeAdd = ({
  reactFlowWrapper,
  reactFlowInstance,
  customNodes,
  components,
  addNodes,
}: {
  reactFlowWrapper: MutableRefObject<HTMLDivElement | null>;
  reactFlowInstance: MutableRefObject<ReactFlowInstance | null>;
  customNodes: CustomNodeSpecification<object, any>[];
  components: NodeSpecification[];
  addNodes: DecisionGraphStoreType['actions']['addNodes'];
}) => {
  const addNodeInner = async (type: string, position?: XYPosition, component?: string) => {
    if (!reactFlowWrapper.current || !reactFlowInstance.current) {
      return;
    }

    if (!position) {
      const rect = reactFlowWrapper.current.getBoundingClientRect();
      const rectCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      position = reactFlowInstance.current.screenToFlowPosition(rectCenter);
    }

    const customSpecification = match(type)
      .with('customNode', () => customNodes.find((node) => node.kind === component))
      .otherwise(() => {
        const allSpecifications = [...Object.values(nodeSpecification), ...components];
        return allSpecifications.find((s) => s.type === type);
      });
    if (!customSpecification) {
      toast.error(`Unknown node type ${type} - ${component}.`);
      return;
    }

    let newNode: DecisionNode | null = match(customSpecification)
      .with({ kind: P.string }, (specification) => {
        const existingCount =
          (reactFlowInstance.current?.getNodes() || []).filter((n) => n.data?.kind === specification.kind).length + 1;

        const partialNode = specification.generateNode({ index: existingCount });
        return {
          id: crypto.randomUUID(),
          type: 'customNode',
          name: partialNode.name,
          position: position as XYPosition,
          content: {
            kind: specification.kind,
            config: partialNode?.config,
          },
        } satisfies DecisionNode;
      })
      .with({ type: P.string }, (specification) => {
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
      toast.error(`Unknown node type ${type} - ${component}.`);
      return;
    }

    if (customSpecification.onNodeAdd) {
      try {
        newNode = await customSpecification.onNodeAdd(newNode);
      } catch {
        return;
      }
    }

    const parsed = nodeSchema.safeParse(newNode);
    if (parsed.success) {
      return addNodes([nodeSchema.parse(newNode)]);
    }
    toast.error(parsed.error?.message);
  };

  return addNodeInner;
};
