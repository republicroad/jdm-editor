import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Variable, VariableType } from '@gorules/zen-engine-wasm';
import equal from 'fast-deep-equal/es6/react';
import React, { useEffect } from 'react';

import type { FunctionScope } from '../../helpers/custom-function-schema';
import { isWasmAvailable } from '../../helpers/wasm';
import type { ExpressionStore } from './context/expression-store.context';
import { ExpressionStoreProvider, useExpressionStoreRaw } from './context/expression-store.context';
import { ExpressionCommandBar } from './expression-command-bar';
import type { ExpressionControllerProps } from './expression-controller';
import { ExpressionController } from './expression-controller';
import { ExpressionList } from './expression-list';

export type CustomFunctionProps = {
  inputVariableType?: VariableType;
  debug?: ExpressionStore['debug'];
  hideCommandBar?: boolean;
  customFunctions?: any;
  functionScope?: FunctionScope;
} & ExpressionControllerProps;

export const CustomFunction: React.FC<CustomFunctionProps> = ({
  customFunctions,
  debug,
  hideCommandBar,
  inputVariableType,
  functionScope,
  ...props
}) => {
  const expressionStoreRaw = useExpressionStoreRaw();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={({ active, over }) => {
        if (!over) {
          return;
        }

        const from = active.data.current?.index;
        const to = over.data.current?.index;
        if (from === undefined || to === undefined || from === to) {
          return;
        }

        expressionStoreRaw.getState().swapRows(from, to);
      }}
    >
      <ExpressionStoreProvider>
        <ExpressionController {...props} functionScope={functionScope} />
        {!hideCommandBar && <ExpressionCommandBar />}
        <ExpressionList customFunctions={customFunctions} functionScope={functionScope} />
        <SimulateDataSync debug={debug} inputVariableType={inputVariableType} />
      </ExpressionStoreProvider>
    </DndContext>
  );
};

const SimulateDataSync: React.FC<Pick<CustomFunctionProps, 'debug' | 'inputVariableType'>> = ({
  debug,
  inputVariableType,
}) => {
  const expressionStoreRaw = useExpressionStoreRaw();

  useEffect(() => {
    expressionStoreRaw.setState({ inputVariableType });
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
