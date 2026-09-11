import {
  type DragEndEvent,
  type DragOverEvent,
  DndContext,
  type SensorDescriptor,
  type SensorOptions,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Variable, VariableType } from '@gorules/zen-engine-wasm';
import equal from 'fast-deep-equal/es6/react';
import React, { useEffect } from 'react';

import type { FunctionScope } from '../../helpers/custom-function-schema';
import { isWasmAvailable } from '../../helpers/wasm';
import type { ExpressionEntry, ExpressionStore } from './context/expression-store.context';
import { ExpressionStoreProvider, useExpressionStoreRaw } from './context/expression-store.context';
import { ExpressionCommandBar } from './expression-command-bar';
import type { ExpressionControllerProps } from './expression-controller';
import { ExpressionController } from './expression-controller';
import { ExpressionList } from './expression-list';

export type CustomFunctionProps = {
  value?: ExpressionEntry[];
  onChange?: (value: ExpressionEntry[]) => void;
  defaultValue?: ExpressionEntry[];
  disabled?: boolean;
  permission?: 'edit:full' | 'edit:values' | 'view';
  /**
   * Deliberately opaque in public props: wasm/zod-typed shapes crash
   * Storybook docgen (SB_DOCS-TOOLS_0001). The component re-narrows them
   * internally before use.
   */
  inputVariableType?: unknown;
  debug?: unknown;
  hideCommandBar?: boolean;
  customFunctions?: any;
  functionScope?: unknown;
};
export const CustomFunction: React.FC<CustomFunctionProps> = ({
  customFunctions,
  debug,
  hideCommandBar,
  inputVariableType,
  functionScope,
  ...props
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Keyboard reorder: focus the row handle, Space/Enter to pick up, arrows to
    // move, Space/Enter to drop, Escape to cancel; the sortable coordinate
    // getter snaps arrow-moves to the neighbouring row.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <ExpressionStoreProvider>
      <ExpressionDndBoard sensors={sensors}>
        <ExpressionController
          {...(props as ExpressionControllerProps)}
          functionScope={functionScope as FunctionScope | undefined}
        />
        {!hideCommandBar && <ExpressionCommandBar />}
        <ExpressionList customFunctions={customFunctions} functionScope={functionScope as FunctionScope | undefined} />
        <SimulateDataSync debug={debug} inputVariableType={inputVariableType} />
      </ExpressionDndBoard>
    </ExpressionStoreProvider>
  );
};

type ExpressionDndBoardProps = {
  sensors: SensorDescriptor<SensorOptions>[];
  children: React.ReactNode;
};

/** DndContext 壳：必须在 ExpressionStoreProvider 内渲染——重排回调读写真实 store */
const ExpressionDndBoard: React.FC<ExpressionDndBoardProps> = ({ sensors, children }) => {
  const expressionStoreRaw = useExpressionStoreRaw();

  // 拖拽中实时重排（roadmap 3.2 落点修正）：items 随 over 即时更新，
  // 后续箭头移动基于新排列计算——落点确定，不再依赖拖放瞬间的投影推算
  const reorderLive = ({ active, over }: DragEndEvent | DragOverEvent) => {
    if (!over) {
      return;
    }

    const from = active.data.current?.index;
    const to = over.data.current?.index;
    if (from === undefined || to === undefined || from === to) {
      return;
    }

    expressionStoreRaw.getState().moveRows(from, to);
  };

  return (
    <DndContext
      sensors={sensors}
      // rows reorder mid-drag, so droppable rects must be re-measured
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      // 垂直列表标准碰撞检测（行高内容驱动、不固定，closestCorners 在此不稳）
      collisionDetection={closestCenter}
      onDragOver={reorderLive}
      onDragEnd={reorderLive}
    >
      {children}
    </DndContext>
  );
};

const SimulateDataSync: React.FC<Pick<CustomFunctionProps, 'debug' | 'inputVariableType'>> = ({
  debug: debugUnknown,
  inputVariableType,
}) => {
  const debug = debugUnknown as ExpressionStore['debug'];
  const expressionStoreRaw = useExpressionStoreRaw();

  useEffect(() => {
    expressionStoreRaw.setState({ inputVariableType: inputVariableType as VariableType | undefined });
  }, [inputVariableType]);

  useEffect(() => {
    const currentState = expressionStoreRaw.getState();
    if (equal(currentState.debug, debug)) {
      return;
    }

    expressionStoreRaw.setState({ debug });
  }, [debug]);

  useEffect(() => {
    if (!isWasmAvailable()) {
      return;
    }

    const isLoop = (store: ExpressionStore) => {
      return store.debug?.snapshot.executionMode === 'loop';
    };

    const applyDebug = (state: ExpressionStore) => {
      const inputData = state.debug?.inputData;
      if (!inputData) {
        return;
      }

      const varInputData = new Variable(inputData.data);
      if (isLoop(state)) {
        let newInputData = varInputData.get(state.debugIndex).cloneWith('$nodes', inputData.$nodes);
        if (inputData.$) {
          newInputData = newInputData.cloneWith('$', inputData.$);
        }

        expressionStoreRaw.setState({
          calculatedInputData: newInputData,
          inputVariableType: VariableType.fromVariable(newInputData),
        });
      } else {
        let newInputData = varInputData.cloneWith('$nodes', inputData.$nodes);
        if (inputData.$) {
          newInputData = newInputData.cloneWith('$', inputData.$);
        }

        expressionStoreRaw.setState({
          calculatedInputData: newInputData,
          inputVariableType: VariableType.fromVariable(newInputData),
        });
      }
    };

    applyDebug(expressionStoreRaw.getState());
    return expressionStoreRaw.subscribe((state, prevState) => {
      if (state.debugIndex === prevState.debugIndex && state.debug === prevState.debug) {
        return;
      }

      applyDebug(state);
    });
  }, []);

  return null;
};
