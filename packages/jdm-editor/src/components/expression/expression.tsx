import { Variable, VariableType } from '@gorules/zen-engine-wasm';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import equal from 'fast-deep-equal/es6/react';
import React, { useEffect, useRef, useState } from 'react';

import { isWasmAvailable } from '../../helpers/wasm';
import type { ExpressionDebug } from './context/expression-store.context';
import { ExpressionStoreProvider, useExpressionStoreRaw } from './context/expression-store.context';
import { ExpressionCommandBar } from './expression-command-bar';
import type { ExpressionControllerProps } from './expression-controller';
import { ExpressionController } from './expression-controller';
import { ExpressionList } from './expression-list';
import './expression.scss';

export type ExpressionProps = {
  inputVariableType?: VariableType;
  debug?: ExpressionDebug;
  hideCommandBar?: boolean;
} & ExpressionControllerProps;

export const Expression: React.FC<ExpressionProps> = ({
  debug,
  hideCommandBar,
  inputVariableType,
  ...props
}) => {
  const [_, setMounted] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div ref={container}>
      {container.current && (
        <ExpressionStoreProvider>
          <ExpressionDnd>
            <ExpressionController {...props} />
            {!hideCommandBar && <ExpressionCommandBar />}
            <ExpressionList />
            <SimulateDataSync debug={debug} inputVariableType={inputVariableType} />
          </ExpressionDnd>
        </ExpressionStoreProvider>
      )}
    </div>
  );
};

const ExpressionDnd: React.FC<React.PropsWithChildren> = ({ children }) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const store = useExpressionStoreRaw();

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

        store.getState().swapRows(from, to);
      }}
    >
      {children}
    </DndContext>
  );
};

const SimulateDataSync: React.FC<Pick<ExpressionProps, 'debug' | 'inputVariableType'>> = ({
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

    const isLoop = (store: { debug?: ExpressionDebug; debugIndex: number }) => {
      return store.debug?.snapshot.executionMode === 'loop';
    };

    const applyDebug = (state: { debug?: ExpressionDebug; debugIndex: number }) => {
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
