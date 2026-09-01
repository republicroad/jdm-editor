import type { VariableType } from '@gorules/zen-engine-wasm';
import type { Row } from '@tanstack/react-table';
import { Select, Tabs, Typography } from 'antd';
import clsx from 'clsx';
import equal from 'fast-deep-equal/es6/react';
import { GripVerticalIcon } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';

import {
  emptyCustomFunctionReturnSchema,
  type FunctionScope,
  getFunctionNameFromValue,
  getFunctionReturnSchema,
  isFunctionExpression,
  normalizeCustomFunctions,
  normalizeFunctionReturns,
} from '../../helpers/custom-function-schema';
import { getTrace } from '../../helpers/trace';
import { parseOperatorExprInput, smartSplit, toOperatorExprArray, toOperatorExprDisplay } from '../../helpers/utility';
import { useTranslation } from '../../locales';
import { CodeEditor } from '../code-editor';
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
  customFunctions?: any;
  functionScope?: FunctionScope;
};

const emptyReturnSchema = emptyCustomFunctionReturnSchema;

export const ExpressionItem: React.FC<ExpressionItemProps> = ({
  expression,
  index,
  variableType,
  customFunctions,
  functionScope,
}) => {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [editMode, setEditMode] = useState<'code' | 'function'>('function');
  const expressionRef = useRef<HTMLDivElement>(null);
  const scopeMode = functionScope?.mode ?? 'free';
  const normalizedCustomFunctions = useMemo(() => normalizeCustomFunctions(customFunctions), [customFunctions]);
  const availableFunctions = useMemo(
    () => (scopeMode === 'scoped' ? (functionScope?.functions ?? []) : normalizedCustomFunctions),
    [scopeMode, functionScope, normalizedCustomFunctions],
  );
  const hasCustomFunctions = availableFunctions.length > 0;

  const getEnumOptions = (argDef?: any) => {
    if (!Array.isArray(argDef?.enum) || argDef.enum.length === 0) {
      return [];
    }

    return argDef.enum.map((item: unknown) => ({
      label: String(item),
      value: String(item),
    }));
  };

  const stripExpressionStringQuotes = (value: string) => {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }

    return value;
  };

  const toEnumExpressionValue = (value: string, argDef?: any) => {
    const isStringEnum =
      argDef?.type === 'string' ||
      (Array.isArray(argDef?.enum) && argDef.enum.every((item: unknown) => typeof item === 'string'));

    if (isStringEnum) {
      return JSON.stringify(value);
    }

    return value;
  };

  const splitFunctionParts = (value: string | string[], expectedArgCount?: number): string[] => {
    if (Array.isArray(value)) {
      return value;
    }

    const str = value;
    const parts = smartSplit(str);
    if (expectedArgCount === undefined) {
      return parts;
    }

    const expectedPartCount = expectedArgCount + 1;
    if (parts.length === expectedPartCount) {
      return parts;
    }

    const simpleParts = str.split(';;');
    if (simpleParts.length === expectedPartCount) {
      return simpleParts;
    }

    if (parts.length < expectedPartCount && simpleParts.length > expectedPartCount) {
      return [...simpleParts.slice(0, expectedPartCount - 1), simpleParts.slice(expectedPartCount - 1).join(';;')];
    }

    return parts;
  };

  const parseFunctionValue = (
    value: string | string[],
    fallbackReturnSchema: any = expression.returnSchema ?? emptyReturnSchema,
  ) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return null;
    }

    const parts = toOperatorExprArray(value);
    const funcName = parts[0];

    const funcDef = normalizedCustomFunctions.find((f: any) => f.name === funcName);
    if (!funcDef) {
      if (parts.length === 0) {
        return null;
      }

      const args = parts.slice(1);
      const properties: Record<string, any> = {};
      args.forEach((_arg, index) => {
        properties[`arg${index}`] = {
          type: 'string',
          description: `Parameter ${index + 1}`,
          default: '',
        };
      });

      return {
        funcmeta: {
          name: funcName,
          parameters: {
            properties,
            type: 'object',
            title: funcName,
          },
          returns: normalizeFunctionReturns(fallbackReturnSchema),
        },
        arg_exprs: args.reduce(
          (acc, arg, index) => {
            acc[`arg${index}`] = arg;
            return acc;
          },
          {} as Record<string, any>,
        ),
      };
    }

    const argExprs: Record<string, string> = {};
    if (funcDef.parameters && funcDef.parameters.properties) {
      const properties = funcDef.parameters.properties;
      const propertyNames = Object.keys(properties);
      const partsForArgs = splitFunctionParts(value, propertyNames.length);
      const args = partsForArgs.slice(1);

      propertyNames.forEach((argName: string, index: number) => {
        const argValue = args[index];
        argExprs[argName] =
          argValue !== undefined && argValue !== null ? String(argValue) : (properties[argName].default ?? '');
      });
    }

    return {
      funcmeta: funcDef,
      arg_exprs: argExprs,
    };
  };

  const currentFunctionInfo = useMemo(() => {
    const isFunctionType = isFunctionExpression(expression);

    if (!isFunctionType) {
      return null;
    }

    if (expression.funcmeta) {
      if (expression.funcmeta.parameters?.properties) {
        const argExprs: Record<string, string> = {};
        const properties = expression.funcmeta.parameters.properties;
        const parsedFromValue = parseFunctionValue(expression.value, expression.returnSchema ?? emptyReturnSchema);

        Object.keys(properties).forEach((argName) => {
          const parsedValue = parsedFromValue?.arg_exprs?.[argName];
          if (parsedValue !== undefined && parsedValue !== null) {
            argExprs[argName] = String(parsedValue);
            return;
          }

          const currentValue = expression.arg_exprs?.[argName];
          if (currentValue !== undefined && currentValue !== null) {
            argExprs[argName] = typeof currentValue === 'object' ? String(parsedValue ?? '') : String(currentValue);
          } else {
            argExprs[argName] = properties[argName].default ?? '';
          }
        });

        return {
          funcmeta: expression.funcmeta,
          arg_exprs: argExprs,
        };
      }

      return {
        funcmeta: expression.funcmeta,
        arg_exprs: expression.arg_exprs || {},
      };
    }

    return parseFunctionValue(expression.value, expression.returnSchema ?? emptyReturnSchema);
  }, [expression.type, expression.funcmeta, expression.arg_exprs, expression.value, normalizedCustomFunctions]);

  const { updateRow, removeRow, swapRows, disabled, permission, configurable } = useExpressionStore(
    ({ updateRow, removeRow, swapRows, disabled, permission, configurable }) => ({
      updateRow,
      removeRow,
      swapRows,
      disabled,
      permission,
      configurable: configurable ?? permission === 'edit:full',
    }),
  );

  useEffect(() => {
    if (isFunctionExpression(expression) && currentFunctionInfo?.funcmeta) {
      setEditMode('function');
    }
  }, [expression.type, expression.value]);

  useEffect(() => {
    if (!isFunctionExpression(expression) || !currentFunctionInfo?.funcmeta) {
      return;
    }

    const nextReturnSchema = getFunctionReturnSchema(currentFunctionInfo.funcmeta);
    if (equal(expression.returnSchema, nextReturnSchema)) {
      return;
    }

    updateRow(index, {
      type: 'function',
      returnSchema: nextReturnSchema,
    });
  }, [index, expression.type, expression.value, expression.returnSchema, currentFunctionInfo, updateRow]);

  const onChange = (update: Partial<Omit<ExpressionEntry, 'id'>>) => {
    updateRow(index, update);
  };

  const buildFunctionValue = (funcmeta: any, argExprs: Record<string, any>): string[] => {
    const properties = funcmeta?.parameters?.properties ?? {};
    const argValues = Object.keys(properties).map((argName) => String(argExprs?.[argName] ?? ''));
    return [funcmeta?.name ?? '', ...argValues];
  };

  const onSelectFunction = (funcName: string, option: any) => {
    const funcmeta = option?.fun;
    if (!funcmeta) {
      return;
    }

    const properties = funcmeta?.parameters?.properties ?? {};
    const argExprs: Record<string, string> = {};
    Object.keys(properties).forEach((argName) => {
      argExprs[argName] = properties[argName].default ?? '';
    });

    onChange({
      value: buildFunctionValue(funcmeta, argExprs),
      type: 'function',
      returnSchema: getFunctionReturnSchema(funcmeta),
      funcmeta,
      arg_exprs: argExprs,
    });
  };

  const onArgChange = (argName: string, argValue: string) => {
    const currentInfo = currentFunctionInfo;
    if (!currentInfo?.funcmeta) {
      return;
    }

    const nextArgExprs: Record<string, any> = { ...currentInfo.arg_exprs };
    nextArgExprs[argName] = argValue;

    onChange({
      value: buildFunctionValue(currentInfo.funcmeta, nextArgExprs),
      type: 'function',
      arg_exprs: nextArgExprs,
    });
  };

  const onRemove = () => {
    removeRow(index);
  };

  const [{ isDropping, direction }, dropRef] = useDrop({
    accept: 'row',
    collect: (monitor) => ({
      isDropping: monitor.isOver({ shallow: true }),
      direction: (monitor.getDifferenceFromInitialOffset()?.y || 0) > 0 ? 'down' : 'up',
    }),
    drop: (draggedRow: Row<Record<string, string>>) => {
      swapRows(draggedRow.index, index);
    },
  });

  const [{ isDragging }, dragRef, previewRef] = useDrag({
    canDrag: permission === 'edit:full' && !disabled,
    item: () => ({ ...expression, index }),
    type: 'row',
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  previewRef(dropRef(expressionRef));

  const functionOptions = availableFunctions.map((func: any) => ({
    value: func.name,
    label: func.name,
    fun: func,
  }));

  return (
    <div
      ref={expressionRef}
      className={clsx(
        'expression-list-item',
        'expression-list__item',
        isDropping && direction === 'down' && 'dropping-down',
        isDropping && direction === 'up' && 'dropping-up',
        expression?._diff?.status && `expression-list__item--${expression?._diff?.status}`,
      )}
      style={{ opacity: !isDragging ? 1 : 0.5 }}
    >
      <div
        ref={dragRef}
        className='expression-list-item__drag'
        aria-disabled={permission !== 'edit:full' || disabled}
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
            placeholder={t('key')}
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
        <Tabs
          activeKey={hasCustomFunctions ? editMode : 'code'}
          onChange={(key) => setEditMode(key as 'code' | 'function')}
          size='small'
          items={[
            ...(hasCustomFunctions
              ? [
                  {
                    key: 'function',
                    label: t('function'),
                    children: (
                      <div className='function-mode-container'>
                        <div className='function-select-container'>
                          <Select
                            value={currentFunctionInfo?.funcmeta?.name || undefined}
                            placeholder={t('function')}
                            style={{ minWidth: 200, width: 240 }}
                            onChange={(value, item: any) => onSelectFunction(value, item)}
                            options={functionOptions}
                            disabled={!configurable || disabled}
                          />
                        </div>
                        <div className='function-args-container'>
                          <div className='function-args-list'>
                            {currentFunctionInfo?.funcmeta?.parameters?.properties &&
                              Object.keys(currentFunctionInfo.funcmeta.parameters.properties).map((argName: string) => {
                                const argDef = currentFunctionInfo.funcmeta.parameters.properties[argName];
                                const placeholder = argDef?.description || '';
                                const requiredArgs = currentFunctionInfo.funcmeta?.parameters?.required;
                                const isRequired = Array.isArray(requiredArgs) && requiredArgs.includes(argName);

                                let value = '';
                                const argValue = currentFunctionInfo?.arg_exprs?.[argName];
                                if (argValue !== undefined && argValue !== null) {
                                  value = typeof argValue === 'object' ? argDef?.default || '' : String(argValue);
                                } else {
                                  value = argDef?.default || '';
                                }

                                const enumOptions = getEnumOptions(argDef);

                                return (
                                  <div key={argName} className='function-arg-row'>
                                    <Typography.Text
                                      className='function-arg-row__label'
                                      ellipsis={{ tooltip: argDef?.description || argName }}
                                    >
                                      {argName}
                                      {isRequired && <span className='function-arg-row__required'>*</span>}
                                    </Typography.Text>
                                    {enumOptions.length > 0 ? (
                                      <Select
                                        className='function-arg-row__editor'
                                        placeholder={placeholder}
                                        value={value ? stripExpressionStringQuotes(value) : undefined}
                                        options={enumOptions}
                                        style={{ width: '100%' }}
                                        onChange={(nextValue) =>
                                          onArgChange(argName, toEnumExpressionValue(nextValue, argDef))
                                        }
                                        disabled={!configurable || disabled}
                                      />
                                    ) : (
                                      <CodeEditor
                                        key={argName}
                                        noStyle
                                        lint={false}
                                        className='function-arg-code-editor'
                                        placeholder={placeholder}
                                        value={value}
                                        maxRows={3}
                                        disabled={!configurable || disabled}
                                        variableType={variableType}
                                        onChange={(nextValue) => onArgChange(argName, nextValue)}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                        <ResultOverlay expression={expression} placement='inline' />
                      </div>
                    ),
                  },
                ]
              : []),
            {
              key: 'code',
              label: t('code'),
              children: (
                <ExpressionItemContextMenu index={index}>
                  <div className='code-mode-container'>
                    <div className='code-editor-container'>
                      <DiffCodeEditor
                        className='expression-list-item__value'
                        placeholder='Expression'
                        maxRows={9}
                        disabled={disabled}
                        value={toOperatorExprDisplay(expression?.value)}
                        displayDiff={expression?._diff?.fields?.value?.status === 'modified'}
                        previousValue={toOperatorExprDisplay(
                          expression?._diff?.fields?.value?.previousValue ?? '',
                        )}
                        onChange={(value) => onChange({ value: parseOperatorExprInput(value) })}
                        variableType={variableType}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        noStyle={true}
                      />
                    </div>
                    <ResultOverlay expression={expression} placement='inline' />
                  </div>
                </ExpressionItemContextMenu>
              ),
            },
          ]}
        />
      </div>
      <div className='expression-list-item__action'>
        {<ConfirmAction iconOnly disabled={permission !== 'edit:full' || disabled} onConfirm={onRemove} />}
        {isFocused && <LivePreview id={expression.id} value={expression.value} />}
      </div>
    </div>
  );
};

const LivePreview = React.memo<{ id: string; value: string | string[] }>(({ id, value }) => {
  const { inputData, initial } = useExpressionStore(({ debug, debugIndex, calculatedInputData }) => {
    const snapshot = (debug?.snapshot?.expressions ?? []).find((e) => e.id === id);
    const trace = snapshot?.key ? getTrace(debug?.trace.traceData, debugIndex)?.[snapshot.key] : undefined;

    return {
      inputData: calculatedInputData,
      initial: snapshot && trace ? { expression: toOperatorExprDisplay(snapshot.value), result: trace.result } : undefined,
    };
  });

  return (
    <div className='expression-list-item__livePreview'>
      <CodeEditorPreview expression={toOperatorExprDisplay(value)} inputData={inputData} initial={initial} />
    </div>
  );
});

const ResultOverlay: React.FC<{ expression: ExpressionEntry; placement?: 'floating' | 'inline' }> = ({
  expression,
  placement = 'floating',
}) => {
  const { trace } = useExpressionStore(({ debug, debugIndex }) => ({
    trace: resolveExpressionResult({
      traceData: getTrace(debug?.trace?.traceData, debugIndex),
      output: getTrace(debug?.trace?.output, debugIndex),
      outputPath: debug?.snapshot?.outputPath,
      key: expression.key,
    }),
  }));

  if (trace === undefined) {
    return null;
  }

  const traceText = formatTraceText(trace);

  return (
    <div
      className={clsx(
        'expression-list-item__resultOverlay',
        placement === 'inline' && 'expression-list-item__resultOverlay--inline',
      )}
    >
      <Typography.Text
        ellipsis={{
          tooltip: <div className='expression-list-item__resultOverlayTooltip'>{traceText}</div>,
        }}
        style={{ maxWidth: placement === 'inline' ? 220 : 60, overflow: 'hidden' }}
      >
        = {traceText}
      </Typography.Text>
    </div>
  );
};

const resolveExpressionResult = ({
  traceData,
  output,
  outputPath,
  key,
}: {
  traceData: unknown;
  output: unknown;
  outputPath?: string | null;
  key?: string;
}) => {
  if (!key) {
    return undefined;
  }

  const traceEntry = readObjectValue(traceData, key);
  if (isRecord(traceEntry) && Object.prototype.hasOwnProperty.call(traceEntry, 'result')) {
    return traceEntry.result;
  }

  if (traceEntry !== undefined) {
    return traceEntry;
  }

  const scopedOutput = outputPath ? readPathValue(output, outputPath) : output;
  const scopedOutputValue = readObjectValue(scopedOutput, key);
  if (scopedOutputValue !== undefined) {
    return scopedOutputValue;
  }

  return readObjectValue(output, key);
};

const readObjectValue = (data: unknown, key: string) => {
  if (!isRecord(data) || !Object.prototype.hasOwnProperty.call(data, key)) {
    return undefined;
  }

  return data[key];
};

const readPathValue = (data: unknown, path: string) => {
  return path.split('.').reduce<unknown>((current, part) => readObjectValue(current, part), data);
};

const isRecord = (data: unknown): data is Record<string, unknown> => {
  return !!data && typeof data === 'object' && !Array.isArray(data);
};

const formatTraceText = (data: unknown) => {
  const json = JSON.stringify(data);
  return json === undefined ? String(data) : json;
};
