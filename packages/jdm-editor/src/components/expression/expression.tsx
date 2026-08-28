import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Variable, VariableType } from '@gorules/zen-engine-wasm';
import equal from 'fast-deep-equal/es6/react';
import React, { useEffect, useRef, useState } from 'react';

import { DragOverlayCard, OverlayChip, OverlayIndexChip } from '../../helpers/dnd-overlay';
import { isWasmAvailable } from '../../helpers/wasm';
import type { ExpressionDebug } from './context/expression-store.context';
import { ExpressionStoreProvider, useExpressionStoreRaw } from './context/expression-store.context';
import { ExpressionCommandBar } from './expression-command-bar';
import type { ExpressionControllerProps } from './expression-controller';
import { ExpressionController } from './expression-controller';
import { ExpressionList } from './expression-list';

export type ExpressionProps = {
  inputVariableType?: VariableType;
  debug?: ExpressionDebug;
  hideCommandBar?: boolean;
} & ExpressionControllerProps;

export const Expression: React.FC<ExpressionProps> = ({ debug, hideCommandBar, inputVariableType, ...props }) => {
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Imperative read: entry content cannot change mid-drag, and a
  // subscription would re-render on every keystroke in any item.
  const activeEntry = activeIndex == null ? undefined : store.getState().expressions[activeIndex];

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => {
        const index = active.data.current?.index;
        if (typeof index === 'number') {
          setActiveIndex(index);
        }
      }}
      onDragEnd={({ active, over }) => {
        setActiveIndex(null);
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
      onDragCancel={() => setActiveIndex(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeEntry ? (
          <DragOverlayCard>
            <OverlayIndexChip index={activeIndex ?? 0} />
            {activeEntry.key ? <OverlayChip width={140}>{activeEntry.key}</OverlayChip> : null}
            {activeEntry.value ? (
              <OverlayChip width={180}>
                <span style={{ color: 'var(--grl-color-text-tertiary)' }}>{activeEntry.value}</span>
              </OverlayChip>
            ) : null}
          </DragOverlayCard>
        ) : null}
      </DragOverlay>
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
