import type { VariableType } from '@gorules/zen-engine-wasm';
import { useDraggable, useDroppable, useDndContext } from '@dnd-kit/core';
import { Typography } from '../primitives';
import clsx from 'clsx';
import { GripVerticalIcon } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { getDropDirection } from '../../helpers/dnd';
import { getTrace } from '../../helpers/trace';
import { CodeEditorPreview } from '../code-editor/ce-preview';
import { ConfirmAction } from '../confirm-action';
import { DiffIcon } from '../diff-icon';
import { DiffAutosizeTextArea } from '../shared';
import { DiffCodeEditor } from '../shared/diff-ce';
import type { ExpressionEntry } from './context/expression-store.context';
import { useExpressionStore } from './context/expression-store.context';
import { ExpressionItemContextMenu } from './expression-item-context-menu';

export type ExpressionItemProps = {
  expression: ExpressionEntry;
  index: number;
  variableType?: VariableType;
};

export const ExpressionItem: React.FC<ExpressionItemProps> = ({ expression, index, variableType }) => {
  const [isFocused, setIsFocused] = useState(false);
  const expressionRef = useRef<HTMLDivElement>(null);
  const { updateRow, removeRow, disabled, permission } = useExpressionStore(
    ({ updateRow, removeRow, disabled, permission }) => ({
      updateRow,
      removeRow,
      disabled,
      permission,
    }),
  );

  const onChange = (update: Partial<Omit<ExpressionEntry, 'id'>>) => {
    updateRow(index, update);
  };

  const onRemove = () => {
    removeRow(index);
  };

  const actionDisabled = permission !== 'edit:full' || disabled;

  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    setActivatorNodeRef,
    isDragging,
  } = useDraggable({
    id: `expr-${expression.id ?? index}`,
    data: { index },
    disabled: actionDisabled,
  });

  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `expr-drop-${expression.id ?? index}`,
    data: { index },
  });

  const dndContext = useDndContext();
  const direction = isOver
    ? getDropDirection(dndContext.active?.rect.current.translated, expressionRef.current?.getBoundingClientRect())
    : 'up';

  return (
    <div
      ref={(el) => {
        expressionRef.current = el;
        setDropNodeRef(el);
        setDragNodeRef(el);
      }}
      className={clsx(
        'expression-list-item',
        'expression-list__item',
        isOver && direction === 'down' && 'dropping-down',
        isOver && direction === 'up' && 'dropping-up',
        expression?._diff?.status && `expression-list__item--${expression?._diff?.status}`,
      )}
      style={{ opacity: !isDragging ? 1 : 0.5 }}
    >
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className='expression-list-item__drag'
        aria-disabled={actionDisabled}
      >
        <div className='expression-list-item__drag__inner'>
          {expression?._diff?.status ? (
            <DiffIcon
              status={expression?._diff?.status}
              style={{
                fontSize: 16,
              }}
            />
          ) : (
            <GripVerticalIcon size={10} />
          )}
        </div>
      </div>
      <div className='expression-list-item__key'>
        <ExpressionItemContextMenu index={index}>
          <DiffAutosizeTextArea
            noStyle
            placeholder='Key'
            maxRows={10}
            readOnly={permission !== 'edit:full' || disabled}
            displayDiff={expression?._diff?.fields?.key?.status === 'modified'}
            previousValue={expression?._diff?.fields?.key?.previousValue}
            value={expression?.key}
            onChange={(e) => onChange({ key: e.target.value })}
          />
        </ExpressionItemContextMenu>
      </div>
      <div className='expression-list-item__code'>
        <ExpressionItemContextMenu index={index}>
          <div>
            <DiffCodeEditor
              className='expression-list-item__value'
              placeholder='Expression'
              maxRows={9}
              disabled={disabled}
              value={expression?.value}
              displayDiff={expression?._diff?.fields?.value?.status === 'modified'}
              previousValue={expression?._diff?.fields?.value?.previousValue}
              onChange={(value) => onChange({ value })}
              variableType={variableType}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              noStyle={true}
            />
            <ResultOverlay expression={expression} />
          </div>
        </ExpressionItemContextMenu>
      </div>
      <div className='expression-list-item__action'>
        <ConfirmAction iconOnly disabled={permission !== 'edit:full' || disabled} onConfirm={onRemove} />
        {isFocused && <LivePreview id={expression.id} value={expression.value} />}
      </div>
    </div>
  );
};

const LivePreview = React.memo<{ id: string; value: string }>(({ id, value }) => {
  const { inputData, initial } = useExpressionStore(({ debug, debugIndex, calculatedInputData }) => {
    const snapshot = (debug?.snapshot?.expressions ?? []).find((e) => e.id === id);
    const trace = snapshot?.key ? getTrace(debug?.trace.traceData, debugIndex)?.[snapshot.key] : undefined;

    return {
      inputData: calculatedInputData,
      initial: snapshot && trace ? { expression: snapshot.value, result: trace.result } : undefined,
    };
  });

  return (
    <div className='expression-list-item__livePreview'>
      <CodeEditorPreview expression={value} inputData={inputData} initial={initial} />
    </div>
  );
});

const ResultOverlay: React.FC<{ expression: ExpressionEntry }> = ({ expression }) => {
  const { trace } = useExpressionStore(({ debug, debugIndex }) => ({
    trace: getTrace(debug?.trace?.traceData, debugIndex)?.[expression.key]?.result,
  }));
  if (trace === undefined) {
    return null;
  }

  return (
    <div className='expression-list-item__resultOverlay'>
      <Typography.Text ellipsis={{ tooltip: (trace ?? undefined) as React.ReactNode }} style={{ maxWidth: 60, overflow: 'hidden' }}>
        = {JSON.stringify(trace)}
      </Typography.Text>
    </div>
  );
};
