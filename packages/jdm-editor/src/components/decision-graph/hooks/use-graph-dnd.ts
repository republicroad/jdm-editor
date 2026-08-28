import type { ReactFlowInstance, XYPosition } from '@xyflow/react';
import type { DragEvent, MutableRefObject } from 'react';
import { toast } from 'sonner';
import { P, match } from 'ts-pattern';

import { nodeSchema } from '../../../helpers/schema';
import type { DecisionGraphStoreType } from '../context/dg-store.context';

type AddNodes = DecisionGraphStoreType['actions']['addNodes'];

/**
 * Palette drag-and-drop handlers: translate the drop point into flow
 * coordinates, then either hydrate a serialized node payload or delegate to
 * the node-add pipeline.
 */
export const useGraphDnd = ({
  reactFlowWrapper,
  reactFlowInstance,
  addNodes,
  addNode,
}: {
  reactFlowWrapper: MutableRefObject<HTMLDivElement | null>;
  reactFlowInstance: MutableRefObject<ReactFlowInstance | null>;
  addNodes: AddNodes;
  addNode: (type: string, position?: XYPosition, component?: string) => Promise<void>;
}) => {
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!reactFlowWrapper.current || !reactFlowInstance.current) {
      return;
    }

    let elementPosition: XYPosition;

    try {
      elementPosition = JSON.parse(event.dataTransfer.getData('relativePosition'));
    } catch {
      return;
    }

    const position = reactFlowInstance.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    }) as XYPosition;

    position.x -= Math.round((elementPosition.x * 226) / 10) * 10;
    position.y -= Math.round((elementPosition.y * 60) / 10) * 10;

    const nodeData = event.dataTransfer.getData('nodeData');
    if (nodeData) {
      try {
        const jsonData = JSON.parse(nodeData);
        addNodes([nodeSchema.parse({ ...jsonData, position })]);
      } catch (err) {
        toast.error('Failed to create a node');
        console.error(err);
      }

      return;
    }

    const type = event.dataTransfer.getData('nodeType');
    const component = match(event.dataTransfer.getData('customNodeComponent'))
      .with(P.string, (c) => c)
      .otherwise(() => undefined);

    void addNode(type, position, component);
  };

  const onDragOver = (event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  return { onDrop, onDragOver };
};
