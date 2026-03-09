import { useTranslation } from '../../locales';
import type { VariableType } from '@gorules/zen-engine-wasm';
import type { Row } from '@tanstack/react-table';
import { Typography, Tabs, AutoComplete, Button, Input, Popconfirm, Select } from 'antd';
import clsx from 'clsx';
import { GripVerticalIcon } from 'lucide-react';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';

import { getTrace } from '../../helpers/trace';
import { smartSplit } from '../../helpers/utility';
import { CodeEditorPreview } from '../code-editor/ce-preview';
import { ConfirmAction } from '../confirm-action';
import { DiffIcon } from '../diff-icon';
import { DiffAutosizeTextArea } from '../shared';
import { DiffCodeEditor } from '../shared/diff-ce';
import { AutosizeTextArea } from '../autosize-text-area';
import type { ExpressionEntry } from './context/expression-store.context';
import { useExpressionStore } from './context/expression-store.context';
import { ExpressionItemContextMenu } from './expression-item-context-menu';
import { useDecisionGraphActions } from '../decision-graph/context/dg-store.context';

export type ExpressionItemProps = {
  expression: ExpressionEntry;
  index: number;
  variableType?: VariableType;
  menuList?: any;
  customFunctions?: any;
};

export const ExpressionItem: React.FC<ExpressionItemProps> = ({ expression, index, variableType, menuList, customFunctions }) => {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [editMode, setEditMode] = useState<'code' | 'function'>('function');
  const expressionRef = useRef<HTMLDivElement>(null);

  // 优化的智能分割函数，正确处理引号内的;;分隔符
  const smartSplit = (str: string): string[] => {
    if (!str || typeof str !== 'string') {
      return [''];
    }
    
    // 先尝试简单分割，看看是否有合理的结构
    const simpleParts = str.split(';;');
    
    // 如果只有一个部分，直接返回
    if (simpleParts.length <= 1) {
      return [str];
    }
    
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const nextChar = str[i + 1];
      
      // 检查是否进入引号
      if ((char === '"' || char === "'" || char === '`') && !inQuotes) {
        // 检查这个引号是否有匹配的结束引号
        const remainingStr = str.substring(i + 1);
        const closingQuoteIndex = remainingStr.indexOf(char);
        
        if (closingQuoteIndex !== -1) {
          // 找到匹配的结束引号，正常处理
          inQuotes = true;
          quoteChar = char;
          current += char;
        } else {
          // 没有找到匹配的结束引号，当作普通字符处理
          current += char;
        }
      } 
      // 检查是否退出引号（找到匹配的结束引号）
      else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } 
      // 检查是否遇到;;分隔符
      else if (char === ';' && nextChar === ';' && !inQuotes) {
        // 不在引号内，正常分割
        result.push(current);
        current = '';
        i++; // 跳过下一个 ;
      } else {
        current += char;
      }
    }
    
    // 添加最后一部分
    result.push(current);
    
    return result;
  };
  

  // 解析;;分隔的value字符串，用于函数模式显示
  const parseFunctionValue = (value: string) => {
    if (!value || typeof value !== 'string') return null;
    
    const parts = smartSplit(value);
    if (parts.length === 0) return null;
    
    const funcName = parts[0];
    const args = parts.slice(1);
    
    // 从customFunctions中找到对应的函数定义
    const funcDef = customFunctions?.find((f: any) => f.name === funcName);
    if (!funcDef) {
      // 如果找不到函数定义，创建一个基本的结构以避免UI崩溃
      return {
        funcmeta: {
          name: funcName,
          arguments: args.map((arg, index) => ({
            arg_name: `arg${index}`,
            comments: `${t('parameter')}${index + 1}`
          }))
        },
        arg_exprs: args.reduce((acc, arg, index) => {
          acc[`arg${index}`] = arg;
          return acc;
        }, {} as Record<string, any>)
      };
    }
    
    // 构建arg_exprs对象
    const argExprs: Record<string, any> = {};
    if (funcDef.arguments && Array.isArray(funcDef.arguments)) {
      funcDef.arguments.forEach((argDef: any, index: number) => {
        if (argDef.arg_name) {
          argExprs[argDef.arg_name] = args[index] ?? '';
        }
      });
    }
    
    return {
      funcmeta: funcDef,
      arg_exprs: argExprs
    };
  };

  // 获取当前表达式的函数信息（用于显示）
  const currentFunctionInfo = useMemo(() => {
    // 检查是否为函数类型：显式的type=function 或者 value包含;;分隔符（推断为函数）
    const isFunctionType = expression.type === 'function' || 
                          (typeof expression.value === 'string' && expression.value.includes(';;'));
    
    if (!isFunctionType) return null;
    
    // 如果已有funcmeta，直接使用
    if (expression.funcmeta) {
      return { funcmeta: expression.funcmeta, arg_exprs: expression.arg_exprs };
    }
    
    // 否则解析value字符串
    return parseFunctionValue(expression.value);
  }, [expression.type, expression.funcmeta, expression.arg_exprs, expression.value, customFunctions]);


  const { updateRow, removeRow, swapRows, disabled, permission, configurable } = useExpressionStore(
    ({ updateRow, removeRow, swapRows, disabled, permission, configurable }) => ({
      updateRow,
      removeRow,
      swapRows,
      disabled,
      permission,
      configurable: configurable ?? (permission === 'edit:full'),
    }),
  );

  const onChange = (update: Partial<Omit<ExpressionEntry, 'id'>>) => {
    // 如果是函数类型的更新，构建;;分隔的value字符串
    if (update.type === 'function' && update.funcmeta) {
      const funcName = update.funcmeta.name || '';
      const args = update.funcmeta.arguments || [];
      const argValues: string[] = [];
      
      // 收集参数值，优先使用传入的arg_exprs，否则使用现有的
      const currentArgExprs = update.arg_exprs || expression.arg_exprs || {};
      args.forEach((arg: any) => {
        const argValue = currentArgExprs[arg.arg_name] ?? '';
        argValues.push(argValue);
      });
      
      // 构建;;分割的字符串格式
      const expressionValue = [funcName, ...argValues].join(';;');
      
      // 更新为简化结构
      const simplifiedUpdate = {
        key: update.key || expression.key,
        value: expressionValue,
        type: 'function'
      };
      
      updateRow(index, simplifiedUpdate);
      
      // 处理特殊函数的清理逻辑
      if (update.funcmeta?.name) {
        const type = update.funcmeta?.name.split('_')[1];
        (update.funcmeta?.name.includes('notify')||update.funcmeta?.name.includes('list') || update.funcmeta?.name.includes('counter')) && graphActions.handleEditorDomClick(update.funcmeta.kind, update.funcmeta.name)
      }
    } else {
      updateRow(index, update);
    }
  };

  const inputChange = (value: any) => {
    // 如果当前表达式是函数类型，需要重新构建value字符串
    if (expression.type === 'function' && currentFunctionInfo) {
      const funcName = currentFunctionInfo.funcmeta.name || '';
      const args = currentFunctionInfo.funcmeta.arguments || [];
      const argValues: string[] = [];
      
      // 更新参数值
      const currentArgExprs = currentFunctionInfo.arg_exprs ? { ...currentFunctionInfo.arg_exprs } : {};
      currentArgExprs[value.key.arg_name] = value.value;
      
      // 收集所有参数值
      args.forEach((arg: any) => {
        const argValue = currentArgExprs[arg.arg_name] ?? '';
        argValues.push(argValue);
      });
      
      // 构建;;分割的字符串格式
      const expressionValue = [funcName, ...argValues].join(';;');
      
      // 更新为简化结构
      updateRow(index, {
        value: expressionValue,
        type: 'function'
      });
    } else {
      // 非函数类型保持原有逻辑
      let last: any = expression?.arg_exprs ? { ...expression.arg_exprs } : {};
      last[value.key.arg_name] = value.value
      updateRow(index, {arg_exprs: last});
    }
  }

  // 焦点重新获取函数列表
  const getList = (name: string) => {
    const type = name.split('_')[1];
    name.includes('notify')&& graphActions.handleEditorDomClick(type, name);
    name.includes('list')&& graphActions.handleEditorDomClick(type, name);
    name.includes('counter')&& graphActions.handleEditorDomClick('counterDetail', name);
  };

  const fun = () => {
    const funColl: any = []
    
    if (customFunctions && Array.isArray(customFunctions) && customFunctions.length > 0) {
      customFunctions.forEach((e: any, index: number) => {
        if (e && e.name) {
          funColl.push({ value: e.name, label: `${e.name}`, name: 'function', fun: e})
        }
      })
    }
    
    return funColl
  }

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

  const graphActions = useDecisionGraphActions();
  const goLink = (e: any, option: any) => {
    e.stopPropagation()
    graphActions.handleEditorDomClick('link', option.list_id)
  }

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
      <div ref={dragRef} className='expression-list-item__drag' aria-disabled={permission !== 'edit:full' || disabled}>
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
      <div
        className='expression-list-item__key'
        onClick={(e) => {
          if (e.target instanceof HTMLTextAreaElement) {
            return;
          }

          const inputElement = e.currentTarget.querySelector<HTMLTextAreaElement>('textarea');
          if (!inputElement) {
            return;
          }

          inputElement.focus();
          const inputLength = inputElement.value.length;
          inputElement.setSelectionRange(inputLength, inputLength);
        }}
      >
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
            autoComplete='off'
          />
        </ExpressionItemContextMenu>
      </div>
      <div className='expression-list-item__code'>
        <Tabs
          activeKey={editMode}
          onChange={(key) => setEditMode(key as 'code' | 'function')}
          size="small"
          items={[
            {
              key: 'function',
              label: 'Function',
              children: (
                <div className="function-mode-container">
                  <div className="function-select-container">
                    <Select
                      defaultValue={currentFunctionInfo?.funcmeta?.name || expression?.type}
                      style={{ minWidth: 200, width: 240 }}
                      onChange={(value, item: any) => onChange({ type: 'function', funcmeta: item.fun || '', arg_exprs: {} })}
                      options={fun()}
                      disabled={!configurable || disabled}
                    />
                  </div>
                  <div className='function-args-container'>
                    <div className='flex gap-2'>
                      {(currentFunctionInfo?.funcmeta?.arguments || []).map((ele: any, argIndex: number) => {
                        const placeholder = currentFunctionInfo?.funcmeta?.arguments[argIndex]?.comments;
                        const value = currentFunctionInfo?.arg_exprs?.[ele.arg_name] ?? '';
                        
                        switch (ele.arg_name) {
                          case 'list_name':
                            return (
                              <AutoComplete
                                key={ele.arg_name}
                                placeholder={placeholder}
                                style={{  minWidth: 120, width: 180 }}
                                value={value}
                                popupMatchSelectWidth={180}
                                onChange={(e) => {
                                  inputChange({ value: e?.target?.value || e, type: currentFunctionInfo?.funcmeta?.name, key: ele });
                                }}
                                onFocus={() => {
                                  getList(currentFunctionInfo?.funcmeta?.name || '')
                                }}
                                disabled={!configurable || disabled}
                              >
                                {menuList?.filter((option: any) => option.list_name).map((option: any) => (
                                  <AutoComplete.Option
                                    key={option.list_name}
                                    value={`"${option.list_name}"`}
                                    label={option.list_name}
                                  >
                                    <div className="flex items-center justify-between gap-2" style={{display:'flex',alignItems:'center',justifyContent:'space-between',maxWidth:'180px'}}>
                                      <div
                                        className="max-w-[230px] overflow-hidden whitespace-nowrap"
                                        style={{ textOverflow: 'ellipsis' }}
                                      >
                                        {option.list_name}
                                      </div>
                                      <a
                                        style={{ fontSize: '13px', color: '#1677ff' }}
                                        onClick={(e) => goLink(e, option)}
                                        rel="noopener noreferrer"
                                      >
                                        更多详情
                                      </a>
                                    </div>
                                  </AutoComplete.Option>
                                ))}
                              </AutoComplete>
                            );
                        
                          case 'email_name':
                            return (
                              <AutoComplete
                                key={ele.arg_name}
                                placeholder={placeholder}
                                style={{ minWidth: 120, width: 180 }}
                                value={value}
                                popupMatchSelectWidth={180}
                                onChange={(val) =>
                                  inputChange({ value: val, type: currentFunctionInfo?.funcmeta?.name, key: ele })
                                }
                                onFocus={() => {
                                  getList(currentFunctionInfo?.funcmeta?.name || '')
                                }}
                                disabled={!configurable || disabled}
                              >
                                {menuList?.filter((option: any) => option.email_name).map((option: any) => (
                                  <AutoComplete.Option
                                    key={option.email_name}
                                    value={`"${option.email_name}"`}
                                    label={option.email_name}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div
                                        className="max-w-[230px] overflow-hidden whitespace-nowrap"
                                        style={{ textOverflow: 'ellipsis' }}
                                      >
                                        {option.email_name}
                                      </div>
                                    </div>
                                  </AutoComplete.Option>
                                ))}
                              </AutoComplete>
                            );
                        
                          case 'feishu_name':
                            return (
                              <AutoComplete
                                key={ele.arg_name}
                                placeholder={placeholder}
                                style={{ minWidth: 120, width: 180 }}
                                value={value}
                                popupMatchSelectWidth={180}
                                onChange={(val) =>
                                  inputChange({ value: val, type: currentFunctionInfo?.funcmeta?.name, key: ele })
                                }
                                onFocus={() => {
                                  getList(currentFunctionInfo?.funcmeta?.name || '')
                                }}
                                disabled={!configurable || disabled}
                              >
                                {menuList?.filter((option: any) => option.feishu_name).map((option: any) => (
                                  <AutoComplete.Option
                                    key={option.feishu_name}
                                    value={`"${option.feishu_name}"`}
                                    label={option.feishu_name}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div
                                        className="max-w-[230px] overflow-hidden whitespace-nowrap"
                                        style={{ textOverflow: 'ellipsis' }}
                                      >
                                        {option.feishu_name}
                                      </div>
                                    </div>
                                  </AutoComplete.Option>
                                ))}
                              </AutoComplete>
                            );
                          
                          case 'dingtalk_name':
                            return (
                              <AutoComplete
                                key={ele.arg_name}
                                placeholder={placeholder}
                                style={{ minWidth: 120, width: 180 }}
                                value={value}
                                popupMatchSelectWidth={180}
                                onChange={(val) =>
                                  inputChange({ value: val, type: currentFunctionInfo?.funcmeta?.name, key: ele })
                                }
                                onFocus={() => {
                                  getList(currentFunctionInfo?.funcmeta?.name || '')
                                }}
                                disabled={!configurable || disabled}
                              >
                                {menuList?.filter((option: any) => option.dingtalk_name).map((option: any) => (
                                  <AutoComplete.Option
                                    key={option.dingtalk_name}
                                    value={`"${option.dingtalk_name}"`}
                                    label={option.dingtalk_name}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div
                                        className="max-w-[230px] overflow-hidden whitespace-nowrap"
                                        style={{ textOverflow: 'ellipsis' }}
                                      >
                                        {option.dingtalk_name}
                                      </div>
                                    </div>
                                  </AutoComplete.Option>
                                ))}
                              </AutoComplete>
                            );
                          
                          case 'webhook_name':
                            return (
                              <AutoComplete
                                key={ele.arg_name}
                                placeholder={placeholder}
                                style={{ minWidth: 120, width: 180 }}
                                value={value}
                                popupMatchSelectWidth={180}
                                onChange={(val) =>
                                  inputChange({ value: val, type: currentFunctionInfo?.funcmeta?.name, key: ele })
                                }
                                onFocus={() => {
                                  getList(currentFunctionInfo?.funcmeta?.name || '')
                                }}
                                disabled={!configurable || disabled}
                              >
                                {menuList?.filter((option: any) => option.webhook_name).map((option: any) => (
                                  <AutoComplete.Option
                                    key={option.webhook_name}
                                    value={`"${option.webhook_name}"`}
                                    label={option.webhook_name}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div
                                        className="max-w-[230px] overflow-hidden whitespace-nowrap"
                                        style={{ textOverflow: 'ellipsis' }}
                                      >
                                        {option.webhook_name}
                                      </div>
                                    </div>
                                  </AutoComplete.Option>
                                ))}
                              </AutoComplete>
                            );
                          
                          case 'counter_name':
                            return (
                              <AutoComplete
                                key={ele.arg_name}
                                placeholder={placeholder}
                                style={{ minWidth: 120, width: 180 }}
                                value={value}
                                popupMatchSelectWidth={180}
                                onChange={(val) =>
                                  inputChange({ value: val, type: currentFunctionInfo?.funcmeta?.name, key: ele })
                                }
                                onFocus={() => {
                                  getList(currentFunctionInfo?.funcmeta?.name || '')
                                }}
                                disabled={!configurable || disabled}
                              >
                                {menuList?.filter((option: any) => option.counter_name).map((option: any) => (
                                  <AutoComplete.Option
                                    key={option.counter_name}
                                    value={`"${option.counter_name}"`}
                                    label={option.counter_name}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div
                                        className="max-w-[230px] overflow-hidden whitespace-nowrap"
                                        style={{ textOverflow: 'ellipsis', maxWidth: '180px' }}
                                      >
                                        {option.counter_name}
                                      </div>
                                    </div>
                                  </AutoComplete.Option>
                                ))}
                              </AutoComplete>
                            );
                          
                          case 'counter_method': 
                            return (
                              <AutoComplete
                                key={ele.arg_name}
                                placeholder={placeholder}
                                style={{ minWidth: 120, width: 180 }}
                                value={value}
                                popupMatchSelectWidth={180}
                                onChange={(val) =>
                                  inputChange({ value: val, type: currentFunctionInfo?.funcmeta?.name, key: ele })
                                }
                                disabled={!configurable || disabled}
                              >
                                {[{name: '查询'}, {name: '计算'}].filter((option) => option.name).map((option) => (
                                  <AutoComplete.Option
                                    key={option.name}
                                    value={`"${option.name}"`}
                                    label={option.name}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div
                                        className="max-w-[230px] overflow-hidden whitespace-nowrap"
                                        style={{ textOverflow: 'ellipsis' }}
                                      >
                                        {option.name}
                                      </div>
                                    </div>
                                  </AutoComplete.Option>
                                ))}
                              </AutoComplete>
                            );
                          
                          default:
                            return (
                              <Input
                                key={ele.arg_name}
                                placeholder={placeholder}
                                value={value}
                                style={{ minWidth: 120, width: 160 }}
                                onChange={(e) =>
                                  inputChange({ value: e.target.value, type: currentFunctionInfo?.funcmeta?.name, key: ele })
                                }
                                autoComplete="off"
                              />
                            );
                        }
                      })}
                    </div>
                  </div>
                </div>
              )
            },
            {
              key: 'code',
              label: 'Code',
              children: (
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
              )
            }
          ]}
        />
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
      initial: snapshot && trace ? { expression: snapshot.value, result: safeJson(trace.result) } : undefined,
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
  if (!trace) {
    return null;
  }

  return (
    <div className='expression-list-item__resultOverlay'>
      <Typography.Text ellipsis={{ tooltip: trace }} style={{ maxWidth: 60, overflow: 'hidden' }}>
        = {trace as string}
      </Typography.Text>
    </div>
  );
};

const safeJson = (data: string) => {
  try {
    return JSON.parse(data);
  } catch (err: any) {
    return err.toString();
  }
};
