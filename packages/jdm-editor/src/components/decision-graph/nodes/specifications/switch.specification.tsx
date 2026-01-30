import { ArrowRightOutlined, DeleteOutlined, DownOutlined, PlusOutlined } from '@ant-design/icons';
import type { VariableType } from '@gorules/zen-engine-wasm';
import { Button, Dropdown, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Typography, theme } from 'antd';
import clsx from 'clsx';
import { produce } from 'immer';
import _ from 'lodash';
import { SplitIcon } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Handle, Position } from 'reactflow';
import { P, match } from 'ts-pattern';

import { getNodeData } from '../../../../helpers/node-data';
import { useNodeType } from '../../../../helpers/node-type';
import { DiffCodeEditor } from '../../../shared/diff-ce';
import { useDecisionGraphActions, useDecisionGraphState } from '../../context/dg-store.context';
import { InputDataPreview, OutputDataPreview, type FieldInfo } from '../../graph/input-data-preview';
import type { Diff, DiffMetadata } from '../../dg-types';
import { compareAndUnifyLists } from '../../diff/comparison';
import type { SimulationTrace, SimulationTraceDataSwitch } from '../../simulator/simulation.types';
import { GraphNode } from '../graph-node';
import { NodeColor } from './colors';
import type { MinimalNodeProps, NodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';

// 字段类型定义
type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'unknown';

// 操作符定义
type Operator = {
  value: string;
  label: string;
  expression: (field: string, value?: string) => string;
  needsValue: boolean;
  valueType?: 'text' | 'number' | 'boolean' | 'date';
  group?: string; // 分组名称
};

// 生成比较操作符（用于减少冗余代码）
const generateCompareOperators = (
  funcName: string,
  funcLabel: string,
  valueType: 'number' | 'text' = 'number'
): Operator[] => {
  const transform = (f: string) => funcName === 'value' ? f : `${funcName}(${f})`;
  const formatValue = (v: string) => valueType === 'number' ? v : `"${v}"`;

  return [
    { value: `${funcName}_eq`, label: `${funcLabel}等于`, expression: (f, v) => `${transform(f)} == ${formatValue(v!)}`, needsValue: true, valueType },
    { value: `${funcName}_neq`, label: `${funcLabel}不等于`, expression: (f, v) => `${transform(f)} != ${formatValue(v!)}`, needsValue: true, valueType },
    { value: `${funcName}_gt`, label: `${funcLabel}大于`, expression: (f, v) => `${transform(f)} > ${formatValue(v!)}`, needsValue: true, valueType },
    { value: `${funcName}_gte`, label: `${funcLabel}大于等于`, expression: (f, v) => `${transform(f)} >= ${formatValue(v!)}`, needsValue: true, valueType },
    { value: `${funcName}_lt`, label: `${funcLabel}小于`, expression: (f, v) => `${transform(f)} < ${formatValue(v!)}`, needsValue: true, valueType },
    { value: `${funcName}_lte`, label: `${funcLabel}小于等于`, expression: (f, v) => `${transform(f)} <= ${formatValue(v!)}`, needsValue: true, valueType },
  ];
};

// 根据类型获取操作符列表
const getOperatorsByType = (type: FieldType): Operator[] => {
  const commonOperators: Operator[] = [
    { value: 'exists', label: '存在', expression: (f) => `${f} != null`, needsValue: false, group: '基础操作' },
    { value: 'not_exists', label: '不存在', expression: (f) => `${f} == null`, needsValue: false, group: '基础操作' },
  ];

  const typeOperators: Record<FieldType, Operator[]> = {
    string: [
      ...commonOperators,
      // 值比较组
      ...generateCompareOperators('value', '', 'text').map(op => ({ ...op, group: '值比较' })),
      // 字符串操作组
      { value: 'contains', label: '包含', expression: (f, v) => `contains(${f}, "${v}")`, needsValue: true, valueType: 'text', group: '字符串操作' },
      { value: 'not_contains', label: '不包含', expression: (f, v) => `!contains(${f}, "${v}")`, needsValue: true, valueType: 'text', group: '字符串操作' },
      { value: 'starts_with', label: '开头是', expression: (f, v) => `startsWith(${f}, "${v}")`, needsValue: true, valueType: 'text', group: '字符串操作' },
      { value: 'ends_with', label: '结尾是', expression: (f, v) => `endsWith(${f}, "${v}")`, needsValue: true, valueType: 'text', group: '字符串操作' },
      { value: 'matches_regex', label: '正则匹配', expression: (f, v) => `matches(${f}, "${v}")`, needsValue: true, valueType: 'text', group: '字符串操作' },
      { value: 'not_matches_regex', label: '不匹配正则', expression: (f, v) => `!matches(${f}, "${v}")`, needsValue: true, valueType: 'text', group: '字符串操作' },
      { value: 'is_empty', label: '为空', expression: (f) => `${f} == ""`, needsValue: false, group: '字符串操作' },
      { value: 'is_not_empty', label: '不为空', expression: (f) => `${f} != ""`, needsValue: false, group: '字符串操作' },
      // 长度比较组
      ...generateCompareOperators('len', '长度', 'number').map(op => ({ ...op, group: '长度比较' })),
    ],
    number: [
      ...commonOperators,
      // 值比较组
      ...generateCompareOperators('value', '', 'number').map(op => ({ ...op, group: '值比较' })),
    ],
    boolean: [
      ...commonOperators,
      { value: 'is_true', label: '为真', expression: (f) => `${f} == true`, needsValue: false, group: '值比较' },
      { value: 'is_false', label: '为假', expression: (f) => `${f} == false`, needsValue: false, group: '值比较' },
     
    ],
    date: [
      ...commonOperators,
      { value: 'equals', label: '等于', expression: (f, v) => `d(${f}).isSame(d("${v}"))`, needsValue: true, valueType: 'date', group: '值比较' },
      { value: 'not_equals', label: '不等于', expression: (f, v) => `!(d(${f}).isSame(d("${v}")))`, needsValue: true, valueType: 'date', group: '值比较' },
      { value: 'is_before', label: '早于', expression: (f, v) => `d(${f}).isBefore(d("${v}"))`, needsValue: true, valueType: 'date', group: '值比较' },
      { value: 'is_after', label: '晚于', expression: (f, v) => `d(${f}).isAfter(d("${v}"))`, needsValue: true, valueType: 'date', group: '值比较' },
      { value: 'is_on_or_before', label: '早于或等于', expression: (f, v) => `d(${f}).isSameOrBefore(d("${v}"))`, needsValue: true, valueType: 'date', group: '值比较' },
      { value: 'is_on_or_after', label: '晚于或等于', expression: (f, v) => `d(${f}).isSameOrAfter(d("${v}"))`, needsValue: true, valueType: 'date', group: '值比较' },
      { value: 'is_date', label: '是否是合法日期', expression: (f, v) => `d(${f}).isValid())`, needsValue: false, valueType: 'date', group: '值比较' }
    ],
    array: [
      ...commonOperators,
      // 数组操作组
      { value: 'contains', label: '包含元素', expression: (f, v) => `${v} in ${f}`, needsValue: true, valueType: 'text', group: '数组操作' },
      { value: 'not_contains', label: '不包含元素', expression: (f, v) => `!(${v} in ${f})`, needsValue: true, valueType: 'text', group: '数组操作' },
      { value: 'is_empty', label: '为空数组', expression: (f) => `len(${f}) == 0`, needsValue: false, group: '数组操作' },
      { value: 'is_not_empty', label: '不为空数组', expression: (f) => `len(${f}) > 0`, needsValue: false, group: '数组操作' },
      // 长度比较组
      ...generateCompareOperators('len', '长度', 'number').map(op => ({ ...op, group: '长度比较' })),
      // 聚合函数组
      ...generateCompareOperators('max', '最大值', 'number').map(op => ({ ...op, group: '聚合函数' })),
      ...generateCompareOperators('min', '最小值', 'number').map(op => ({ ...op, group: '聚合函数' })),
      ...generateCompareOperators('sum', '总和', 'number').map(op => ({ ...op, group: '聚合函数' })),
      ...generateCompareOperators('mean', '平均值', 'number').map(op => ({ ...op, group: '聚合函数' })),
    ],
    object: [
      ...commonOperators,
    ],
    unknown: [
      ...commonOperators,
      ...generateCompareOperators('value', '', 'text').map(op => ({ ...op, group: '值比较' })),
    ],
  };

  return typeOperators[type] || typeOperators.unknown;
};

// 将操作符转换为分组选项格式
const getGroupedOperatorOptions = (type: FieldType) => {
  const operators = getOperatorsByType(type);
  const groups = new Map<string, Operator[]>();

  // 按组分类
  operators.forEach(op => {
    const groupName = op.group || '其他';
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(op);
  });

  // 转换为 Select OptGroup 格式
  return Array.from(groups.entries()).map(([groupName, ops]) => ({
    label: groupName,
    options: ops.map(op => ({
      value: op.value,
      label: op.label,
    })),
  }));
};

// 获取字段类型的显示名称
const getFieldTypeLabel = (type: FieldType): string => {
  const labels: Record<FieldType, string> = {
    string: '文本',
    number: '数字',
    boolean: '布尔',
    date: '日期',
    array: '数组',
    object: '对象',
    unknown: '未知',
  };
  return labels[type];
};

// 选中的字段信息
type SelectedField = {
  path: string;
  type: FieldType;
  value?: unknown;
};



export type SwitchStatement = {
  id: string;
  condition?: string;
  isDefault?: boolean;
} & Diff;

export type NodeSwitchData = {
  hitPolicy?: 'first' | 'collect';
  statements?: (SwitchStatement & Diff)[];
} & Diff;

export const switchSpecification: NodeSpecification<NodeSwitchData> = {
  type: NodeKind.Switch,
  icon: <SplitIcon size='1em' />,
  displayName: '条件分支',
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions/switch',
  shortDescription: 'Conditional branching',
  color: NodeColor.Purple,
  getDiffContent: (current, previous) => {
    return produce(current, (draft) => {
      const fields: DiffMetadata['fields'] = {};
      if ((current.hitPolicy ?? '') !== (previous.hitPolicy ?? '')) {
        _.set(fields, 'hitPolicy', {
          status: 'modified',
          previousValue: current.hitPolicy,
        });
      }

      const statements = compareAndUnifyLists(current?.statements || [], previous?.statements || [], {
        compareFields: (current, previous) => {
          const hasConditionChange = (current.condition ?? '') !== previous.condition;
          // const hasIsDefaultChange = (current.isDefault ?? false) !== (previous.isDefault ?? false);

          return {
            hasChanges: hasConditionChange,
            fields: {
              ...(hasConditionChange && {
                condition: {
                  status: 'modified',
                  previousValue: previous.condition,
                },
              }),
              // ...(hasIsDefaultChange && {
              //   isDefault: {
              //     status: 'modified',
              //     previousValue: previous.isDefault,
              //   },
              // }),
            },
          };
        },
      });

      draft.statements = statements;
      if (
        statements.find(
          (statement) =>
            statement?._diff?.status === 'modified' ||
            statement?._diff?.status === 'added' ||
            statement?._diff?.status === 'removed',
        )
      ) {
        _.set(fields, 'statements', {
          status: 'modified',
        });
      }

      if (Object.keys(fields).length > 0) {
        draft._diff = {
          status: 'modified',
          fields,
        };
      }
      return draft;
    });
  },
  inferTypes: {
    needsUpdate: () => false,
    determineOutputType: (state) => state.input,
  },
  generateNode: ({ index }) => ({
    name: `switch${index}`,
    content: {
      hitPolicy: 'first',
      statements: [{ id: crypto.randomUUID(), condition: '', isDefault: false }],
    },
  }),
  renderNode: ({ specification, onRunNode, runLoading, ...props }) => <SwitchNode specification={specification} onRunNode={onRunNode} runLoading={runLoading} {...props} />,
};

const SwitchNode: React.FC<
  MinimalNodeProps & {
    specification: Pick<NodeSpecification, 'displayName' | 'icon' | 'documentationUrl'>;
    onRunNode?: (nodeId: string) => void;
    runLoading?: boolean;
  }
> = ({ id, data, selected, specification, onRunNode, runLoading }) => {
  const graphActions = useDecisionGraphActions();
  const { token } = theme.useToken();
  const { ref: inViewRef, inView } = useInView({ delay: 1_000 });
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [localStatements, setLocalStatements] = useState<SwitchStatement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [conditionForm] = Form.useForm();

  // 条件构建器状态
  const [selectedField, setSelectedField] = useState<SelectedField | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [operatorValue, setOperatorValue] = useState<string>('');
  // 用户覆盖的字段类型（仅当原始类型为 string 时可切换为 date）
  const [overrideFieldType, setOverrideFieldType] = useState<FieldType | null>(null);


  // 使用 ref 来跟踪最新的 localStatements，避免闭包问题
  // 注意：不要在渲染时直接赋值 localStatementsRef.current = localStatements
  // 因为 setState 是异步的，渲染时 localStatements 可能还是旧值，会覆盖我们手动更新的 ref
  const localStatementsRef = useRef<SwitchStatement[]>([]);

  // 使用 ref 来同步跟踪 selectedStatementId，避免 onChange 中的闭包问题
  const selectedStatementIdRef = useRef<string | null>(null);

  // 用于存储待设置的表单值，避免 setTimeout 的时序问题
  const pendingFormValueRef = useRef<{ id: string; condition: string } | null>(null);

  // 当 selectedStatementId 变化时，设置表单值
  useEffect(() => {
    if (pendingFormValueRef.current && pendingFormValueRef.current.id === selectedStatementId) {
      conditionForm.setFieldsValue({ condition: pendingFormValueRef.current.condition });
      pendingFormValueRef.current = null;
    }
  }, [selectedStatementId, conditionForm]);

  const { content, disabled, nodeTrace, compactMode, isGraphActive, inputData } = useDecisionGraphState(
    ({ decisionGraph, disabled, simulate, compactMode, activeTab }) => ({
      nodeTrace: match(simulate)
        .with({ result: P._ }, ({ result }) => result?.trace?.[id] as SimulationTrace<SimulationTraceDataSwitch>)
        .otherwise(() => null),
      content: (decisionGraph?.nodes || []).find((n) => n?.id === id)?.content as NodeSwitchData | undefined,
      disabled,
      compactMode,
      isGraphActive: activeTab === 'graph',
      inputData: match(simulate)
        .with({ result: P.nonNullable }, ({ result }) =>
          result.trace?.[id] ? getNodeData(id, { trace: result.trace, decisionGraph }) : null
        )
        .otherwise(() => null),
    }),
  );

  const nodeType = useNodeType(id, { disabled: !isGraphActive || !inView });
  const statements: SwitchStatement[] = content?.statements || [];
  const hitPolicy = content?.hitPolicy || 'first';

  // 弹窗打开时阻止键盘快捷键触发节点操作（删除、复制、剪切、粘贴等）
  useEffect(() => {
    if (!isConditionModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.monaco-editor') ||
        target.closest('.cm-editor') ||
        target.closest('[contenteditable="true"]');

      // 阻止 Delete 和 Backspace 键触发节点删除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isEditable) {
          e.stopPropagation();
          e.preventDefault();
        }
      }

      // 阻止 Cmd/Ctrl+C、Cmd/Ctrl+X、Cmd/Ctrl+V 触发节点复制/剪切/粘贴
      // 这些操作在可编辑区域应该正常工作，但不应该触发图形编辑器的节点操作
      if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'x' || e.key === 'v')) {
        // 阻止事件冒泡到图形编辑器，但允许浏览器默认的复制/剪切/粘贴行为
        e.stopPropagation();
      }
    };

    // 使用 capture 阶段捕获事件，确保在其他处理器之前执行
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isConditionModalOpen]);

  const changeHitPolicy = (hitPolicy: string) => {
    graphActions.updateNode(id, (node) => {
      node.content.hitPolicy = hitPolicy;
      return node;
    });
  };

  const Handle = useMemo(() => (compactMode ? SwitchHandleCompact : SwitchHandle), [compactMode]);

  return (
    <>
      <GraphNode
      id={id}
      ref={inViewRef}
      className={clsx(['switch'])}
      specification={specification}
      name={data.name}
      handleRight={false}
      onRunNode={onRunNode}
      runLoading={runLoading}
      helper={[<ArrowRightOutlined key='arrow-right' />]}
      noBodyPadding
      isSelected={selected}
      actions={[
        <Button
          key='add condition'
          type='text'
          disabled={disabled}
          onClick={() => {
            // 加载当前所有条件到本地状态
            const initialStatements = JSON.parse(JSON.stringify(statements));
            localStatementsRef.current = initialStatements;
            setLocalStatements(initialStatements);

            // 重置条件构建器状态
            setSelectedField(null);
            setSelectedOperator(null);
            setOperatorValue('');
            setOverrideFieldType(null);

            // 如果有条件，默认选中第一个
            if (initialStatements.length > 0) {
              const firstStatement = initialStatements[0];
              // 先更新 ref，再设置表单值，避免 onChange 中的闭包问题
              selectedStatementIdRef.current = firstStatement.id;
              conditionForm.setFieldsValue({ condition: firstStatement.condition || '' });
              pendingFormValueRef.current = null;
              setSelectedStatementId(firstStatement.id);
            } else {
              selectedStatementIdRef.current = null;
              setSelectedStatementId(null);
              conditionForm.setFieldsValue({ condition: '' });
            }

            setIsConditionModalOpen(true);
          }}
        >
          Add Condition
        </Button>,
        <Dropdown
          key='hitPolicy'
          trigger={['click']}
          placement='bottomRight'
          menu={{
            items: [
              {
                key: 'first',
                label: 'First',
                onClick: () => changeHitPolicy('first'),
                disabled,
              },
              {
                key: 'collect',
                label: 'Collect',
                disabled,
                onClick: () => {
                  graphActions.updateNode(id, (draft) => {
                    draft.content.statements = ((draft.content.statements || []) as SwitchStatement[]).map(
                      (statement) => {
                        if (statement.isDefault) {
                          statement.isDefault = false;
                        }
                        return statement;
                      },
                    );
                    return draft;
                  });
                  changeHitPolicy('collect');
                },
              },
            ],
          }}
        >
          <Button type='text' style={{ textTransform: 'capitalize', marginLeft: 'auto' }}>
            {hitPolicy} <DownOutlined />
          </Button>
        </Dropdown>,
      ]}
    >
      <div className='switchNode'>
        <div className='switchNode__body edit nodrag'>
          {!(statements?.length > 0) && (
            <Typography.Text type={'secondary'} className={'no-conditions'}>
              No conditions
            </Typography.Text>
          )}
          {statements.map((statement, index) => (
            <Handle
              key={statement.id}
              index={index}
              value={statement.condition}
              diff={statement?._diff}
              id={statement.id}
              isDefault={statement.isDefault}
              totalStatements={statements.length}
              disabled={disabled}
              hitPolicy={hitPolicy}
              variableType={nodeType}
              onSetIsDefault={(val) => {
                graphActions.updateNode(id, (draft) => {
                  const draftStatement = draft.content.statements.find((s: SwitchStatement) => {
                    return s.id === statement.id;
                  });
                  if (val) {
                    draftStatement.condition = '';
                  }
                  draftStatement.isDefault = val;
                  return draft;
                });
              }}
              isActive={match(nodeTrace?.traceData)
                .with({ statements: P.array(P._) }, ({ statements }) =>
                  statements.some((s) => typeof s === 'object' && s && 'id' in s && s.id === statement?.id),
                )
                .otherwise(() => false)}
            />
          ))}
        </div>
      </div>
    </GraphNode>
      <Modal
        title={data.name || '条件分支'}
        open={isConditionModalOpen}
        maskClosable={false}
        onCancel={() => {
          setIsConditionModalOpen(false);
          localStatementsRef.current = [];
          setLocalStatements([]);
          selectedStatementIdRef.current = null;
          setSelectedStatementId(null);
          // 清空表单中的 condition
          conditionForm.setFieldsValue({ condition: '' });
          // 清空待设置的表单值
          pendingFormValueRef.current = null;
          // 清空条件构建器状态
          setSelectedField(null);
          setSelectedOperator(null);
          setOperatorValue('');
          setOverrideFieldType(null);
        }}
        width="90vw"
        style={{ top: '5vh' }}
        styles={{
          body: { height: '80vh', overflow: 'hidden', padding: 0 },
          content: { borderRadius: 8 },
        }}
        okText="保存"
        cancelText="取消"
        onOk={() => {
          // 保存所有条件到节点
          graphActions.updateNode(id, (draft) => {
            draft.content.statements = localStatementsRef.current;
            return draft;
          });
          setIsConditionModalOpen(false);
          localStatementsRef.current = [];
          setLocalStatements([]);
          selectedStatementIdRef.current = null;
          setSelectedStatementId(null);
          // 清空表单中的 condition
          conditionForm.setFieldsValue({ condition: '' });
          // 清空待设置的表单值
          pendingFormValueRef.current = null;
          // 清空条件构建器状态
          setSelectedField(null);
          setSelectedOperator(null);
          setOperatorValue('');
          setOverrideFieldType(null);
        }}
        modalRender={(modal) => (
          <div
            onKeyDown={(e) => {
              // 阻止键盘事件冒泡，防止触发节点删除等操作
              e.stopPropagation();
            }}
            onCopy={(e) => {
              // 阻止复制事件冒泡，防止触发节点复制
              e.stopPropagation();
            }}
            onCut={(e) => {
              // 阻止剪切事件冒泡，防止触发节点剪切
              e.stopPropagation();
            }}
            onPaste={(e) => {
              // 阻止粘贴事件冒泡，防止触发节点粘贴
              e.stopPropagation();
            }}
          >
            {modal}
          </div>
        )}
      >
        <PanelGroup direction="horizontal" style={{ height: '100%' }}>
          {/* 左侧：输入数据预览 */}
          <Panel defaultSize={20} minSize={15} maxSize={30}>
            <div style={{
              height: '100%',
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              backgroundColor: token.colorBgContainer,
            }}>
              <InputDataPreview
                data={inputData?.data}
                onFieldClick={(field: FieldInfo) => {
                  // 如果没有选中条件，不执行
                  if (!selectedStatementId) return;

                  // 将 FieldInfo 的类型映射到我们的 FieldType
                  const mapFieldType = (type: FieldInfo['type']): FieldType => {
                    if (type === 'null' || type === 'undefined') return 'unknown';
                    return type as FieldType;
                  };

                  // 设置选中的字段
                  setSelectedField({
                    path: field.path,
                    type: mapFieldType(field.type),
                    value: field.value,
                  });

                  // 重置操作符、值和覆盖类型
                  setSelectedOperator(null);
                  setOperatorValue('');
                  setOverrideFieldType(null);
                }}
              />
            </div>
          </Panel>

          <PanelResizeHandle
            style={{
              width: 0,
              backgroundColor: 'transparent',
              transition: 'background-color 0.2s',
            }}
            className="resize-handle"
          />

          {/* 中间左：条件列表 */}
          <Panel defaultSize={15} minSize={15} maxSize={35}>
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: token.colorBgContainer,
            }}>
              {/* 标题栏 */}
              <div
                style={{
                  padding: '8px 12px',
                  borderBottom: `1px solid ${token.colorBorder}`,
                  backgroundColor: token.colorBgContainer,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography.Text strong style={{ fontSize: 13 }}>
                  条件列表
                </Typography.Text>
                <Button
                  type="primary"
                  size="small"
                  className='h-[22px]'
                  onClick={() => {
                    // 获取当前编辑的条件内容
                    const currentCondition = conditionForm.getFieldValue('condition') || '';
                    const currentSelectedId = selectedStatementId;

                    // 创建新条件
                    const newStatement: SwitchStatement = {
                      id: crypto.randomUUID(),
                      condition: '',
                      isDefault: false,
                    };

                    // 使用 ref 获取最新的 localStatements
                    const latestStatements = localStatementsRef.current;

                    // 一次性更新：保存当前条件 + 添加新条件
                    const updatedStatements = currentSelectedId
                      ? latestStatements.map(s => s.id === currentSelectedId ? { ...s, condition: currentCondition } : s)
                      : latestStatements;

                    const newStatements = [...updatedStatements, newStatement];
                    // 同步更新 ref
                    localStatementsRef.current = newStatements;

                    // 先更新 ref，再设置表单值，避免 onChange 中的闭包问题
                    selectedStatementIdRef.current = newStatement.id;
                    conditionForm.setFieldsValue({ condition: '' });
                    pendingFormValueRef.current = null;
                    setSelectedStatementId(newStatement.id);
                    setLocalStatements(newStatements);
                  }}
                >
                  添加条件
                </Button>
              </div>

              {/* 条件列表 */}
              <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                {localStatements.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: token.colorTextSecondary,
                    }}
                  >
                    暂无条件，点击"添加加条件"开始
                  </div>
                ) : (
                  localStatements.map((statement, index) => (
                    <div
                      key={statement.id}
                      onClick={() => {
                        // 如果点击的是当前选中的条件，不做任何操作
                        if (statement.id === selectedStatementId) return;

                        // 获取当前编辑的条件内容（从表单获取最新值）
                        const currentCondition = conditionForm.getFieldValue('condition') || '';
                        const currentSelectedId = selectedStatementId;
                        const targetStatementId = statement.id;

                        // 从 ref 中获取最新的 localStatements
                        const latestStatements = localStatementsRef.current;

                        // 先保存当前条件到 localStatements
                        let updatedStatements = latestStatements;
                        if (currentSelectedId) {
                          updatedStatements = latestStatements.map(s =>
                            s.id === currentSelectedId ? { ...s, condition: currentCondition } : s
                          );
                          // 同步更新 ref
                          localStatementsRef.current = updatedStatements;
                        }

                        // 从更新后的 statements 中获取目标条件的内容
                        const targetStatement = updatedStatements.find(s => s.id === targetStatementId);
                        const targetCondition = targetStatement?.condition || '';

                        // 先更新 ref，再设置表单值，避免 onChange 中的闭包问题
                        selectedStatementIdRef.current = targetStatementId;
                        conditionForm.setFieldsValue({ condition: targetCondition });
                        pendingFormValueRef.current = null;
                        setSelectedStatementId(targetStatementId);
                        setLocalStatements(updatedStatements);
                      }}
                      style={{
                        padding: '12px',
                        marginBottom: 8,
                        backgroundColor: selectedStatementId === statement.id ? token.colorPrimaryBg : token.colorBgLayout,
                        border: `1px solid ${selectedStatementId === statement.id ? token.colorPrimary : token.colorBorder}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Typography.Text
                            strong
                            style={{
                              fontSize: 12,
                              color: selectedStatementId === statement.id ? token.colorPrimary : token.colorText,
                            }}
                          >
                            {hitPolicy === 'first'
                              ? (index === 0 ? 'If' : statement.isDefault ? 'Else' : 'Else If')
                              : 'If'
                            }
                          </Typography.Text>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 11 }}
                          >
                            #{index + 1}
                          </Typography.Text>
                        </div>
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newStatements = localStatementsRef.current.filter(s => s.id !== statement.id);
                            // 同步更新 ref 和 state
                            localStatementsRef.current = newStatements;
                            setLocalStatements(newStatements);
                            if (selectedStatementId === statement.id) {
                              const nextStatement = newStatements[0];
                              const nextId = nextStatement?.id || null;
                              // 先更新 ref，再设置表单值，避免 onChange 中的闭包问题
                              selectedStatementIdRef.current = nextId;
                              if (nextId) {
                                conditionForm.setFieldsValue({ condition: nextStatement?.condition || '' });
                              } else {
                                conditionForm.setFieldsValue({ condition: '' });
                              }
                              pendingFormValueRef.current = null;
                              setSelectedStatementId(nextId);
                            }
                          }}
                        />
                      </div>
                      <Typography.Text
                        ellipsis
                        style={{
                          fontSize: 11,
                          color: token.colorTextSecondary,
                          fontFamily: 'var(--mono-font-family)',
                        }}
                      >
                        {statement.condition || '(空条件)'}
                      </Typography.Text>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle
            style={{
              width: 0,
              backgroundColor: 'transparent',
              transition: 'background-color 0.2s',
            }}
            className="resize-handle"
          />

          {/* 中间右：条件编辑区 */}
          <Panel defaultSize={35} minSize={25}>
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: token.colorBgLayout,
            }}>
              {/* 标题栏 */}
              <div
                style={{
                  padding: '8px 12px',
                  borderBottom: `1px solid ${token.colorBorder}`,
                  backgroundColor: token.colorBgContainer,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Typography.Text strong style={{ fontSize: 14 }}>
                  {selectedStatementId ? '编辑条件表达式' : '请选择或添加条件'}
                </Typography.Text>
              </div>

              {/* 编辑区 */}
              {selectedStatementId ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  {/* 条件构建器面板 */}
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: token.colorBgContainer,
                    margin: '8px 8px 0 8px',
                    borderRadius: '6px 6px 0 0',
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderBottom: 'none',
                  }}>
                    <div style={{ marginBottom: 8 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        条件构建器 - 点击左侧字段选择，然后选择操作和值
                      </Typography.Text>
                    </div>

                    <Space.Compact style={{ width: '100%', display: 'flex', gap: 8 }}>
                      {/* 字段选择显示 */}
                      <div style={{
                        flex: 1,
                        padding: '4px 11px',
                        border: `1px solid ${token.colorBorder}`,
                        borderRadius: 6,
                        backgroundColor: selectedField ? token.colorBgContainer : token.colorBgLayout,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: 32,
                      }}>
                        {selectedField ? (
                          <>
                            <Typography.Text style={{ fontFamily: 'var(--mono-font-family)', fontSize: 13 }}>
                              {selectedField.path}
                            </Typography.Text>
                            {/* 当原始类型为 string 时，允许切换为 date 类型 */}
                            {selectedField.type === 'string' ? (
                              <Select
                                size="small"
                                variant="borderless"
                                value={overrideFieldType || selectedField.type}
                                onChange={(value) => {
                                  setOverrideFieldType(value as FieldType);
                                  // 切换类型时重置操作符和值
                                  setSelectedOperator(null);
                                  setOperatorValue('');
                                }}
                                style={{
                                  marginLeft: 8,
                                  minWidth: 60,
                                  backgroundColor: token.colorPrimaryBg,
                                  borderRadius: 4,
                                }}
                                popupMatchSelectWidth={false}
                                suffixIcon={<DownOutlined style={{ fontSize: 10, color: token.colorTextSecondary }} />}
                                options={[
                                  { value: 'string', label: <span style={{ fontSize: 11 }}>文本</span> },
                                  { value: 'date', label: <span style={{ fontSize: 11 }}>日期</span> },
                                ]}
                                labelRender={({ label }) => (
                                  <span style={{ fontSize: 11, color: token.colorTextSecondary }}>{label}</span>
                                )}
                              />
                            ) : (
                              <Typography.Text
                                type="secondary"
                                style={{
                                  fontSize: 11,
                                  backgroundColor: token.colorPrimaryBg,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  marginLeft: 8,
                                }}
                              >
                                {getFieldTypeLabel(selectedField.type)}
                              </Typography.Text>
                            )}
                          </>
                        ) : (
                          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                            点击左侧字段选择...
                          </Typography.Text>
                        )}
                      </div>

                      {/* 操作符选择（分组） - 使用覆盖后的类型 */}
                      <Select
                        style={{ width: 180 }}
                        placeholder="选择操作"
                        value={selectedOperator}
                        onChange={(value) => {
                          setSelectedOperator(value);
                          setOperatorValue('');
                        }}
                        disabled={!selectedField}
                        options={selectedField ? getGroupedOperatorOptions(overrideFieldType || selectedField.type) : []}
                      />

                      {/* 值输入 - 根据操作符类型显示不同控件，使用覆盖后的类型 */}
                      {(() => {
                        const effectiveType = overrideFieldType || selectedField?.type || 'unknown';
                        const operator = selectedField && selectedOperator
                          ? getOperatorsByType(effectiveType).find(op => op.value === selectedOperator)
                          : null;

                        if (!operator || !operator.needsValue) {
                          return (
                            <Input
                              style={{ width: 140 }}
                              placeholder="无需输入值"
                              disabled
                            />
                          );
                        }

                        if (operator.valueType === 'number') {
                          return (
                            <InputNumber
                              style={{ width: 140 }}
                              placeholder="输入数值"
                              value={operatorValue ? Number(operatorValue) : undefined}
                              onChange={(val) => setOperatorValue(val?.toString() || '')}
                            />
                          );
                        }

                        return (
                          <Input
                            style={{ width: 140 }}
                            placeholder="输入值"
                            value={operatorValue}
                            onChange={(e) => setOperatorValue(e.target.value)}
                          />
                        );
                      })()}

                      {/* 插入按钮 */}
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        disabled={!selectedField || !selectedOperator || (() => {
                          const effectiveType = overrideFieldType || selectedField?.type || 'unknown';
                          const op = getOperatorsByType(effectiveType)
                            .find(o => o.value === selectedOperator);
                          return op?.needsValue && !operatorValue;
                        })()}
                        onClick={() => {
                          if (!selectedField || !selectedOperator) return;

                          const effectiveType = overrideFieldType || selectedField.type;
                          const operator = getOperatorsByType(effectiveType)
                            .find(op => op.value === selectedOperator);
                          if (!operator) return;

                          // 生成表达式
                          const expression = operator.expression(selectedField.path, operatorValue);

                          // 获取当前条件
                          const currentCondition = conditionForm.getFieldValue('condition') || '';
                          // 如果已有内容，添加空格
                          const newCondition = currentCondition
                            ? `${currentCondition} ${expression}`
                            : expression;

                          // 更新表单和状态
                          conditionForm.setFieldsValue({ condition: newCondition });
                          const newStatements = localStatementsRef.current.map(s =>
                            s.id === selectedStatementId ? { ...s, condition: newCondition } : s
                          );
                          // 同步更新 ref 和 state
                          localStatementsRef.current = newStatements;
                          setLocalStatements(newStatements);

                          // 重置构建器状态
                          setSelectedField(null);
                          setSelectedOperator(null);
                          setOperatorValue('');
                        }}
                      >
                        插入
                      </Button>
                    </Space.Compact>

                    {/* 逻辑连接符快捷按钮 */}
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>
                        逻辑连接:
                      </Typography.Text>
                      {[
                        { label: 'AND', value: ' && ' },
                        { label: 'OR', value: ' || ' },
                        { label: 'NOT', value: '!' },
                        { label: '(', value: '(' },
                        { label: ')', value: ')' },
                      ].map(item => (
                        <Button
                          key={item.label}
                          size="small"
                          onClick={() => {
                            const currentCondition = conditionForm.getFieldValue('condition') || '';
                            const newCondition = currentCondition + item.value;
                            conditionForm.setFieldsValue({ condition: newCondition });
                            const newStatements = localStatementsRef.current.map(s =>
                              s.id === selectedStatementId ? { ...s, condition: newCondition } : s
                            );
                            // 同步更新 ref 和 state
                            localStatementsRef.current = newStatements;
                            setLocalStatements(newStatements);
                          }}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* 代码编辑器 */}
                  <div style={{
                    flex: 1,
                    padding: 16,
                    overflow: 'auto',
                    backgroundColor: token.colorBgContainer,
                    margin: '0 8px 8px 8px',
                    borderRadius: '0 0 6px 6px',
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderTop: `1px dashed ${token.colorBorderSecondary}`,
                  }}>
                    <Form form={conditionForm} layout="vertical" style={{ height: '100%' }}>
                      <Form.Item
                        name="condition"
                        label={<Typography.Text type="secondary" style={{ fontSize: 12 }}>表达式代码（可直接编辑）</Typography.Text>}
                        style={{ height: '100%', marginBottom: 0 }}
                      >
                        <DiffCodeEditor
                          style={{
                            fontSize: 14,
                            lineHeight: '24px',
                            width: '100%',
                            minHeight: '200px',
                          }}
                          displayDiff={false}
                          value={conditionForm.getFieldValue('condition') || ''}
                          disabled={disabled}
                          onChange={(val) => {
                            conditionForm.setFieldValue('condition', val);
                            // 使用 ref 获取最新的 selectedStatementId，避免闭包问题
                            const currentSelectedId = selectedStatementIdRef.current;
                            if (!currentSelectedId) return;
                            // 实时更新本地状态和 ref
                            const newStatements = localStatementsRef.current.map(s =>
                              s.id === currentSelectedId ? { ...s, condition: val } : s
                            );
                            localStatementsRef.current = newStatements;
                            setLocalStatements(newStatements);
                          }}
                          variableType={nodeType}
                        />
                      </Form.Item>
                    </Form>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: token.colorTextSecondary,
                  }}
                >
                  请从左侧选择一个条件进行编辑
                </div>
              )}
            </div>
          </Panel>

          <PanelResizeHandle
            style={{
              width: 4,
              backgroundColor: 'transparent',
              transition: 'background-color 0.2s',
            }}
            className="resize-handle"
          />

          {/* 右侧：输出数据预览 */}
          <Panel defaultSize={15} minSize={15} maxSize={30}>
            <div style={{
              height: '100%',
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
              backgroundColor: token.colorBgContainer,
            }}>
              <OutputDataPreview data={nodeTrace?.output} />
            </div>
          </Panel>
        </PanelGroup>
      </Modal>
    </>
  );
};

const SwitchHandle: React.FC<{
  id?: string;
  value?: string;
  isDefault?: boolean;
  diff?: DiffMetadata;
  onSetIsDefault?: (isDefault: boolean) => void;
  disabled?: boolean;
  isActive?: boolean;
  configurable?: boolean;
  hitPolicy: 'first' | 'collect';
  totalStatements: number;
  index: number;
  variableType?: VariableType;
}> = ({
  id,
  value,
  diff,
  disabled,
  isActive,
  index = 0,
  isDefault = false,
  onSetIsDefault,
  totalStatements,
  hitPolicy,
}) => {
  const isLastIndex = index === totalStatements - 1;

  const isElse =
    isDefault && hitPolicy === 'first' && isLastIndex && index > 0 && (value || '')?.trim?.()?.length === 0;

  return (
    <div className={clsx('switchNode__statement', isActive && 'active', diff?.status && `diff-${diff?.status}`)}>
      <div
        className={clsx('switchNode__statement__heading', isElse && 'switchNode__statement__heading--without-input')}
      >
        {(index === 0 || hitPolicy === 'collect') && (
          <Button
            disabled={disabled}
            className={clsx('switchNode__statement__heading__action')}
            size={'small'}
            type={'text'}
          >
            If
          </Button>
        )}
        {hitPolicy !== 'collect' && index > 0 && (
          <Button
            className={clsx('switchNode__statement__heading__action', isElse && 'inactive')}
            size={'small'}
            type={'text'}
            disabled={disabled}
            onClick={() => {
              if (isLastIndex && hitPolicy === 'first') {
                onSetIsDefault?.(false);
              }
            }}
          >
            Else If
          </Button>
        )}
        {hitPolicy !== 'collect' && index > 0 && isLastIndex && (
          <Button
            className={clsx('switchNode__statement__heading__action', !isElse && 'inactive')}
            size={'small'}
            type={'text'}
            disabled={disabled}
            onClick={() => {
              if (isLastIndex && hitPolicy === 'first') {
                onSetIsDefault?.(true);
              }
            }}
          >
            Else
          </Button>
        )}
        <div
          style={{
            flexGrow: 1,
          }}
        />
        <Handle
          id={id}
          type='source'
          position={Position.Right}
          className={clsx(isActive && 'switchNode__activeHandle')}
        />
      </div>
      {!isElse && (
        <div className='switchNode__statement__inputArea'>
          <div
            style={{
              fontSize: 12,
              lineHeight: '20px',
              width: '100%',
              padding: '8px',
              minHeight: '40px',
              backgroundColor: '#fafafa',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'var(--mono-font-family)',
              color: value ? 'inherit' : '#bfbfbf',
            }}
          >
            {value || '(空条件)'}
          </div>
        </div>
      )}
    </div>
  );
};

const SwitchHandleCompact: React.FC<{
  id?: string;
  value?: string;
  isDefault?: boolean;
  diff?: DiffMetadata;
  onSetIsDefault?: (isDefault: boolean) => void;
  disabled?: boolean;
  isActive?: boolean;
  hitPolicy: 'first' | 'collect';
  totalStatements: number;
  index: number;
  variableType?: VariableType;
}> = ({ id, value, diff, isActive }) => {
  return (
    <div
      className={clsx('switchNode__statement', 'compact', isActive && 'active', diff?.status && `diff-${diff?.status}`)}
    >
      <div className={clsx('switchNode__statement__inputArea')}>
        <div
          style={{
            fontSize: 12,
            lineHeight: '20px',
            width: '100%',
            padding: '8px',
            minHeight: '40px',
            backgroundColor: '#fafafa',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--mono-font-family)',
            color: value ? 'inherit' : '#bfbfbf',
          }}
        >
          {value || '(空条件)'}
        </div>
      </div>
      <Handle
        id={id}
        type='source'
        position={Position.Right}
        className={clsx(isActive && 'switchNode__activeHandle')}
      />
    </div>
  );
};
