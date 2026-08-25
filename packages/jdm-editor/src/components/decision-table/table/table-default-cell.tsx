import type { CellContext } from '@tanstack/react-table';
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { P, match } from 'ts-pattern';

import { columnIdSelector } from '../../../helpers/components';
import { isWasmAvailable, useWasmReady } from '../../../helpers/wasm';
import {
  type BuilderRef,
  ExpressionBuilder,
  StandardExpressionBuilder,
  focusBuilderRoot,
} from '../../code-editor/business';
import type { DiffMetadata } from '../../decision-graph';
import { DiffAutosizeTextArea } from '../../shared';
import { DiffCodeEditor } from '../../shared/diff-ce';
import {
  type TableSchemaItem,
  useDecisionTableActions,
  useDecisionTableRaw,
  useDecisionTableState,
} from '../context/dt-store.context';
import { getReferenceMap } from '../util';

export type TableDefaultCellProps = {
  context: CellContext<Record<string, string>, string>;
} & React.HTMLAttributes<HTMLDivElement>;

export const TableDefaultCell = memo<TableDefaultCellProps>(({ context, ...props }) => {
  const {
    row: { index },
    column: { id },
    table,
  } = context;

  const tableActions = useDecisionTableActions();
  const { disabled, value, diff } = useDecisionTableState(({ decisionTable, disabled }) => ({
    value: decisionTable?.rules?.[index]?.[id],
    diff: (decisionTable?.rules?.[index] as any)?._diff?.fields?.[id],
    disabled,
  }));

  const column = useDecisionTableState(
    columnIdSelector(id),
    (a, b) => a?.id !== undefined && b?.id !== undefined && a?.id === b?.id,
  );

  const [inner, setInner] = useState(value);
  useLayoutEffect(() => {
    if (inner !== value) {
      setInner(value);
    }
  }, [value]);

  const commit = useCallback(
    (val: string) => {
      setInner(val);
      tableActions.commitData(val, { x: id, y: index });
    },
    [tableActions, setInner],
  );

  return (
    <div
      data-cell-wrapper
      className='flex items-stretch w-full h-full leading-0 [&>*]:grow [&_.grl-ce]:h-full [&_.grl-ce_.cm-editor]:h-full'
      onFocus={() => tableActions.setCursor({ x: id, y: index })}
      onContextMenu={() => tableActions.setCursor({ x: id, y: index })}
      {...props}
    >
      {(table.options.meta as any)?.getCell?.({
        disabled,
        column,
        value: inner,
        diff,
        onChange: commit,
      }) || (
        <TableInputCell disabled={disabled} column={column} value={inner} onChange={commit} diff={diff} index={index} />
      )}
    </div>
  );
});

export type TableCellProps = {
  column?: { colType: string } & TableSchemaItem;
  value: string;
  diff?: DiffMetadata;
  onChange: (value: string) => void;
  disabled?: boolean;
  index: number;
};

enum LocalVariableKind {
  Root,
  Derived,
}

const TableInputCell: React.FC<TableCellProps> = ({ column, value, onChange, disabled, diff, index }) => {
  const id = useMemo(() => crypto.randomUUID(), []);
  const textareaRef = useRef<HTMLTextAreaElement | HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<BuilderRef>(null);
  const raw = useDecisionTableRaw();
  const wasmReady = useWasmReady();

  const {
    inputVariableType,
    localVariableType,
    mode: rawMode,
  } = useDecisionTableState(({ inputVariableType, derivedVariableTypes, mode }) => ({
    inputVariableType,
    mode,
    localVariableType: match(column)
      .with({ colType: 'input', field: P.string }, (c) => ({
        type: LocalVariableKind.Derived,
        value: derivedVariableTypes[c.field] ?? null,
      }))
      .otherwise(() => ({ type: LocalVariableKind.Root, value: inputVariableType })),
  }));

  // Business mode requires WASM; fall back to dev mode until it's ready
  const mode = wasmReady ? rawMode : 'dev';

  useEffect(() => {
    if (!inputVariableType) {
      return;
    }

    if (!column?.field || localVariableType.type !== LocalVariableKind.Derived) {
      return;
    }

    const state = raw.stateStore.getState();

    const resultingType = inputVariableType.clone();
    const calculatedType = inputVariableType.calculateType(column.field);
    resultingType.set('$', calculatedType);

    raw.stateStore.setState({
      derivedVariableTypes: {
        ...state.derivedVariableTypes,
        [column.field]: resultingType,
      },
    });
  }, [inputVariableType, column]);

  useEffect(() => {
    const anchor = containerRef.current ?? textareaRef.current;
    if (!anchor) return;

    const parentContainer = anchor.closest('[data-cell-wrapper]')! as HTMLElement;
    const eventListener = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('.cm-editor, input, textarea, select, button, .ant-select')) return;

      if (builderRef.current) {
        builderRef.current.focus();
      } else {
        focusBuilderRoot(anchor);
      }
    };

    parentContainer.style.cursor = 'text';
    parentContainer.addEventListener('click', eventListener);

    return () => {
      parentContainer.style.cursor = '';
      parentContainer.removeEventListener('click', eventListener);
    };
  }, []);

  if (!column) {
    return (
      <DiffAutosizeTextArea
        id={id}
        ref={textareaRef as any}
        className='border-0! w-full bg-transparent py-[9px] px-3 text-sm opacity-70 focus:shadow-none!'
        maxRows={3}
        value={value}
        disabled={disabled}
        displayDiff={diff?.status === 'modified'}
        previousValue={diff?.previousValue}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const isInputColumn = column.colType === 'input' && column.field;
  const isOutputColumn = column.colType === 'output';

  if (mode === 'business' && isInputColumn) {
    return (
      <div ref={containerRef} className='relative w-full [--b-font-size:14px]'>
        <TableInputCellStatus index={index} columnId={column.id} />
        <ExpressionBuilder
          ref={builderRef}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          fieldType={column.fieldType}
        />
      </div>
    );
  }

  if (mode === 'business' && isOutputColumn) {
    return (
      <div ref={containerRef} className='relative w-full [--b-font-size:14px]'>
        <StandardExpressionBuilder
          ref={builderRef}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          fieldType={column.outputFieldType}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className='relative w-full [--b-font-size:14px]'>
      {column.colType === 'input' && <TableInputCellStatus index={index} columnId={column.id} />}
      <DiffCodeEditor
        lazy
        ref={textareaRef as any}
        id={id}
        type={match(column)
          .with({ colType: 'input', field: P.string }, () => 'unary' as const)
          .otherwise(() => 'standard' as const)}
        className='[--ce-verticalPadding:9px] [--ce-horizontalPadding:0.75rem] [&_.cm-editor]:border-0! [&_.cm-editor]:shadow-none! [&_.cm-editor]:rounded-none [&_.cm-editor]:w-full [&_.cm-editor]:bg-transparent'
        noStyle
        displayDiff={diff?.status === 'modified'}
        previousValue={diff?.previousValue}
        variableType={localVariableType.value}
        maxRows={3}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
};

const TableInputCellStatus: React.FC<{ columnId: string; index: number }> = React.memo(({ columnId, index }) => {
  const inputData = useDecisionTableState(({ calculatedInputData }) => calculatedInputData);
  const expressionContext = useDecisionTableState(({ debug, debugIndex }) => {
    if (!isWasmAvailable() || !debug) {
      return;
    }

    const { trace, snapshot } = debug;
    const referenceMap = getReferenceMap(trace, debugIndex);
    if (!referenceMap) {
      return null;
    }

    const columnDef = snapshot.inputs.find((i) => i.id === columnId);
    if (!columnDef) {
      return null;
    }

    if (!(index in snapshot.rules)) {
      return null;
    }

    const expression = snapshot.rules[index]?.[columnId]?.trim();
    if (!columnDef.field) {
      return { type: 'standard' as const, expression };
    }

    if (!(columnDef.field in referenceMap)) {
      return { type: 'skip' as const };
    }

    return { type: 'unary' as const, expression, $: referenceMap[columnDef.field] };
  });

  const status = useMemo<'hit' | 'no-hit' | 'skip' | null>(() => {
    if (!inputData || !expressionContext) {
      return null;
    }

    const { type, expression, $ } = expressionContext;
    if (type === 'skip') {
      return 'skip';
    }

    if (!expression) {
      return 'hit';
    }

    try {
      let isOk: boolean;
      if (type === 'unary') {
        const newInputData = inputData.cloneWith('$', $);
        isOk = newInputData.evaluateUnaryExpression(expression);
      } else {
        isOk = inputData.evaluateExpression(expression) === true;
      }

      return isOk ? 'hit' : 'no-hit';
    } catch {
      return 'no-hit';
    }
  }, [inputData, expressionContext]);

  if (!status) {
    return null;
  }

  switch (status) {
    case 'hit':
      return (
        <div
          className='absolute top-0.5 left-0.5 z-[5] opacity-80 rounded-full h-[5px] w-[5px] border border-[var(--grl-color-success)] bg-[var(--grl-color-success)]'
          data-status={status}
        />
      );
    case 'no-hit':
      return (
        <div
          className='absolute top-0.5 left-0.5 z-[5] opacity-80 rounded-full h-[5px] w-[5px] border border-[var(--grl-color-border-hover)]'
          data-status={status}
        />
      );
    case 'skip':
      return null;
  }
});
