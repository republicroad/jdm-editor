// 导入必要的依赖
import { DownOutlined } from '@ant-design/icons';
import { type VariableType } from '@gorules/zen-engine-wasm';
import { Button, Checkbox, Form, Typography, theme } from 'antd';
import type { DragDropManager } from 'dnd-core';
import React, { useState } from 'react';
import type { XYPosition } from 'reactflow';
import { match } from 'ts-pattern';

import { CodeEditor } from '../../../code-editor';
import { useDecisionGraphActions, useDecisionGraphState } from '../../context/dg-store.context';
import { type DecisionNode } from '../../dg-types';
import { GraphNode } from '../graph-node';
import type { InferTypeData, MinimalNodeProps, MinimalNodeSpecification } from '../specifications/specification-types';

/**
 * 定义具有泛型类型T的自定义决策节点的基本结构
 * @template T 节点将包含的内容类型
 */
type CustomDecisionNode<T> = {
  id: string;                // 节点的唯一标识符
  name: string;              // 节点的显示名称
  description?: string;      // 节点用途的可选描述
  type?: string;             // 节点的类型分类器
  content?: T;               // 节点的实际内容/数据
  position: XYPosition;      // 节点在图中的位置
};

/**
 * 生成新节点时使用的参数
 */
type GenerateNodeParams = {
  index: number;             // 用于创建唯一节点名称的索引
};

/**
 * 自定义节点类型的综合规范
 * @template Data 此节点将使用的数据结构
 * @template Component 标识节点种类的字符串字面量类型
 */
export type CustomNodeSpecification<Data extends object, Component extends string> = {
  kind: Component;           // 此节点类型的唯一标识符
  color?: string;            // 用于视觉识别的可选颜色
  icon?: React.ReactNode;    // 节点的可选图标
  displayName: string;       // 在UI中显示的人类可读名称
  group?: string;            // 可选的分组类别
  documentationUrl?: string; // 可选的文档链接
  shortDescription?: string; // 节点用途的简短描述
  renderTab?: (props: { id: string; manager?: DragDropManager }) => React.ReactNode; // 可选的标签页渲染器
  calculateDiff?: (current: any, previous: any) => [any, any]; // 用于变更跟踪的可选差异计算
  
  // 生成此类型新节点的函数
  generateNode: (params: GenerateNodeParams) => Omit<DecisionNode, 'position' | 'id' | 'type' | 'content'> & {
    config?: Data;           // 节点的可选配置
  };
  
  // 渲染此节点类型的React组件
  renderNode: React.FC<MinimalNodeProps & { specification: MinimalNodeSpecification }>;

  // 可选的类型推断功能
  inferTypes?: {
    needsUpdate: (state: InferTypeData<Data>, prevState: InferTypeData<Data>) => boolean;
    determineOutputType: (state: InferTypeData<Data>) => VariableType;
  };

  // 当节点添加到图中时的可选回调
  onNodeAdd?: (node: CustomDecisionNode<{ kind: Component; config: Data }>) => Promise<
    CustomDecisionNode<{
      kind: Component;
      config: Data;
    }>
  >;
};

/**
 * 布尔输入控件定义
 */
type BoolInput = {
  control: 'bool';           // 控件类型标识符
  label?: string;            // 可选的标签文本
};

/**
 * 文本输入控件定义
 */
type TextInput = {
  control: 'text';           // 控件类型标识符
  label?: string;            // 可选的标签文本
};

/**
 * 将控件类型映射到对应的TypeScript类型
 */
type InputTypeMap = {
  bool: boolean;             // 布尔控件使用布尔值
  text: string;              // 文本控件使用字符串值
};

/**
 * 输入字段的架构定义
 * @template Name 输入名称的字符串字面量类型
 */
type InputSchema<Name extends string> = {
  name: Name;                // 字段名称（用作表单字段键）
} & (BoolInput | TextInput); // 可能的控件类型的联合

/**
 * 将控件类型映射到其对应的TypeScript类型
 * @template T 控件类型字符串
 */
type ControlToType<T> = T extends keyof InputTypeMap ? InputTypeMap[T] : never;

/**
 * 将点表示法路径拆分为嵌套对象类型
 * @template Path 点表示法路径字符串
 * @template Obj 叶子处的对象类型
 */
type SplitPath<Path extends string, Obj> = Path extends `${infer Prefix}.${infer Rest}`
  ? { [K in Prefix]: SplitPath<Rest, Obj> }
  : { [K in Path]: Obj };

/**
 * 从输入架构数组创建动态对象类型
 * @template T 输入架构数组
 * @template Result 累积结果类型（内部使用）
 */
type CreateDynamicType<T extends ReadonlyArray<unknown>, Result = {}> = T extends readonly [infer First, ...infer Rest]
  ? First extends { control: infer Control extends string; name: infer Name extends string }
    ? CreateDynamicType<Rest, Result & SplitPath<Name, ControlToType<Control>>>
    : Result
  : Result;

/**
 * 创建自定义节点类型的基本配置
 * @template Component 标识节点种类的字符串字面量类型
 * @template InputName 输入字段名称的字符串字面量类型
 * @template Inputs 输入架构数组
 * @template NodeData 从输入生成的对象类型（自动推断）
 */
export type BaseNode<
  Component extends string,
  InputName extends string,
  Inputs extends InputSchema<InputName>[],
  NodeData extends object = CreateDynamicType<Inputs>,
> = {
  kind: Component;           // 此节点类型的唯一标识符
  icon?: React.ReactNode;    // 节点的可选图标
  color?: string;            // 用于视觉识别的可选颜色
  displayName: string;       // 在UI中显示的人类可读名称
  shortDescription?: string; // 节点用途的简短描述
  group?: string;            // 可选的分组类别
  handleLeft?: boolean;      // 是否在左侧显示连接点
  handleRight?: boolean;     // 是否在右侧显示连接点
  inputs?: [...Inputs];      // 输入字段定义
  generateNode?: CustomNodeSpecification<NodeData, Component>['generateNode']; // 可选的自定义节点生成器
  renderNode?: CustomNodeSpecification<NodeData, Component>['renderNode']; // 可选的自定义节点渲染器
  onNodeAdd?: CustomNodeSpecification<NodeData, Component>['onNodeAdd']; // 节点添加时的可选回调
};

/**
 * 从基本节点配置创建自定义JDM节点规范
 * 
 * @template Component 标识节点种类的字符串字面量类型
 * @template InputName 输入字段名称的字符串字面量类型
 * @template Inputs 输入架构数组
 * @param n 基本节点配置
 * @returns 完整的CustomNodeSpecification
 */
export const createJdmNode = <
  Component extends string,
  InputName extends string,
  Inputs extends InputSchema<InputName>[],
>(
  n: BaseNode<Component, InputName, Inputs>,
): CustomNodeSpecification<any, Component> => {
  return {
    kind: n.kind,
    icon: n.icon,
    color: n.color,
    displayName: n.displayName,
    group: n.group,
    shortDescription: n.shortDescription,
    // 如果未提供则使用默认节点生成器
    generateNode:
      n.generateNode ||
      (({ index }) => ({
        name: `${n.kind || n.displayName}${index}`,
      })),
    onNodeAdd: n.onNodeAdd,
    // 如果未提供则使用默认节点渲染器
    renderNode: n.renderNode
      ? n.renderNode
      : ({ id, specification, data, selected }) => {
          const [open, setOpen] = useState(false); // 跟踪表单是否展开的状态
          const { token } = theme.useToken(); // 访问主题令牌
          const { updateNode } = useDecisionGraphActions(); // 图操作钩子
          const node = useDecisionGraphState((state) => (state.decisionGraph?.nodes || []).find((n) => n.id === id));
          const nodeData = node?.content?.config; // 当前节点配置
          return (
            <GraphNode
              id={id}
              specification={specification}
              name={data.name}
              isSelected={selected}
              noBodyPadding
              handleLeft={n.handleLeft}
              handleRight={n.handleRight}
              actions={
                n?.inputs
                  ? [
                      <Button
                        key='edit-table'
                        type='text'
                        style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : undefined }}
                        onClick={() => setOpen((o) => !o)}
                      >
                        <DownOutlined />
                      </Button>,
                    ]
                  : undefined
              }
            >
              {open && n?.inputs && (
                <Form
                  className='grl-dn__cn__form'
                  layout='vertical'
                  initialValues={nodeData}
                  onValuesChange={(_, values) => {
                    // 当表单值更改时更新节点配置
                    updateNode(id, (draft) => {
                      draft.content.config = values;
                      return draft;
                    });
                  }}
                >
                  {/* 根据输入定义生成表单项 */}
                  {(n?.inputs || []).map(({ name, control, label }) => {
                    // 匹配控件类型以渲染适当的表单组件
                    const formItem = match({ control })
                      .with({ control: 'text' }, () => <CodeEditor type='template' />)
                      .with({ control: 'bool' }, () => (
                        <Checkbox>
                          <Typography.Text style={{ fontSize: token.fontSizeSM }}>{label}</Typography.Text>
                        </Checkbox>
                      ))
                      .exhaustive();

                    // 只为非布尔控件在复选框外显示标签
                    const outerLabel = match({ control })
                      .with({ control: 'bool' }, () => null)
                      .otherwise(() => (
                        <Typography.Text style={{ fontSize: token.fontSizeSM }}>{label}</Typography.Text>
                      ));

                    // 根据控件类型设置表单字段值属性名
                    const valuePropName = match({ control })
                      .with({ control: 'bool' }, () => 'checked')
                      .otherwise(() => undefined);

                    return (
                      <Form.Item
                        key={name}
                        name={name as string}
                        label={outerLabel}
                        valuePropName={valuePropName}
                        style={{
                          marginBottom: 4,
                        }}
                      >
                        {formItem}
                      </Form.Item>
                    );
                  })}
                </Form>
              )}
            </GraphNode>
          );
        },
  };
};
