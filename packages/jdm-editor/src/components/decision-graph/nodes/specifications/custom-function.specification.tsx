import { ArrowRightOutlined, SyncOutlined } from '@ant-design/icons';
import { VariableType } from '@gorules/zen-engine-wasm';
import { Button, Form } from 'antd';
import equal from 'fast-deep-equal/es6/react';
import { produce } from 'immer';
import _ from 'lodash';
import { HashIcon } from 'lucide-react';
import React from 'react';
import type { z } from 'zod';

import { useNodeType } from '../../../../helpers/node-type';
import type { customNodeSchema } from '../../../../helpers/schema';
import { DiffInput, DiffRadio, DiffSwitch } from '../../../shared';
import { DiffCodeEditor } from '../../../shared/diff-ce';
import { useDecisionGraphActions, useDecisionGraphState, useNodeDiff } from '../../context/dg-store.context';
import { type Diff, type DiffMetadata } from '../../dg-types';
import { compareAndUnifyLists, compareStringFields } from '../../diff/comparison';
import { CustomFunctionTable } from '../../graph/tab-custom-function-table';
import { GraphNode } from '../graph-node';
import type { NodeDecisionTableData } from './decision-table.specification';
import type { NodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';

export type Expression = {
  id: string;
  key?: string;
  value?: string;
};

type InferredContent = z.infer<typeof customNodeSchema>['content'];

export type NodeExpressionData = Omit<InferredContent, 'expressions'> &
  Diff & {
    expressions: (InferredContent['config']['expressions'][0] & Diff)[];
  };

export const customFunctionSpecification: NodeSpecification<NodeExpressionData> = {
  type: NodeKind.CustomFunction,
  icon: <HashIcon size='1em' />,
  displayName: '自定义节点',
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions/expression',
  shortDescription: 'Mapping utility',
  renderTab: ({ id, manager, userId, projectId }) => <CustomFunctionTable id={id} manager={manager} userId={userId} projectId={projectId} />,
  getDiffContent: (current, previous) => {
    const newContent = produce(current, (draft) => {
      const fields: DiffMetadata['fields'] = {};

      if ((current.config.executionMode || false) !== (previous.config.executionMode || false)) {
        _.set(fields, 'executionMode', {
          status: 'modified',
          previousValue: previous.config.executionMode,
        });
      }

      if (!compareStringFields(current.config.inputField, previous.config.inputField)) {
        _.set(fields, 'inputField', {
          status: 'modified',
          previousValue: previous.config.inputField,
        });
      }

      if (!compareStringFields(current.config.outputPath, previous.config.outputPath)) {
        _.set(fields, 'outputPath', {
          status: 'modified',
          previousValue: previous.config.outputPath,
        });
      }

      if ((current.config.passThrough || false) !== (previous.config.passThrough || false)) {
        _.set(fields, 'passThrough', {
          status: 'modified',
          previousValue: previous.config.passThrough,
        });
      }

      const expressions = compareAndUnifyLists(current?.config.expressions || [], previous?.config.expressions || [], {
        compareFields: (current, previous) => {
          const hasKeyChange = !compareStringFields(current.key, previous.key);
          const hasValueChange = !compareStringFields(current.value, previous.value);

          return {
            hasChanges: hasKeyChange || hasValueChange,
            fields: {
              ...(hasKeyChange && {
                key: {
                  status: 'modified',
                  previousValue: previous.key,
                },
              }),
              ...(hasValueChange && {
                value: {
                  status: 'modified',
                  previousValue: previous.value,
                },
              }),
            },
          };
        },
      });

      draft.expressions = expressions;

      if (
        expressions.find(
          (expr) =>
            expr?._diff?.status === 'modified' || expr?._diff?.status === 'added' || expr?._diff?.status === 'removed',
        )
      ) {
        _.set(fields, 'expressions', {
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
    return newContent;
  },
  inferTypes: {
    needsUpdate: (content, prevContent) => !equal(content, prevContent),
    determineOutputType: ({ input, content }) => {
      let nodeInput = input.clone();
      let determinedType = VariableType.fromJson({ Object: {} });
      if (content.config.inputField) {
        nodeInput = input.calculateType(content.config.inputField);
      }

      if (content.config.executionMode === 'loop') {
        nodeInput = nodeInput.arrayItem();
      }

      (content.config.expressions || []).forEach((expression) => {
        if (!expression.key || !expression.value) {
          return;
        }

        const calculatedType = nodeInput.calculateType(expression.value);

        nodeInput.set(`$.${expression.key}`, calculatedType);
        determinedType.set(expression.key, calculatedType);
      });

      if (content.config.executionMode === 'loop') {
        determinedType = determinedType.toArray();
      }

      if (content.config.outputPath) {
        const newType = VariableType.fromJson({ Object: {} });
        newType.set(content.config.outputPath, determinedType);
        determinedType = newType;
      }

      if (content.config.passThrough) {
        determinedType = input.merge(determinedType);
      }

      return determinedType;
    },
  },
  generateNode: ({ index }) => ({
    name: `customNode${index}`,
    content: {
      config: {
        version: "v2",
        meta: {
          user: "",
          proj: ""
        },
        expressions: [],
        inputField: null,
        outputPath: null,
        passThrough: false,
        executionMode: 'single',
      },
    },
  }),
  renderNode: ({ id, data, selected, specification }) => {
    const graphActions = useDecisionGraphActions();
    const { passThrough, executionMode } = useDecisionGraphState(({ decisionGraph }) => {
      const content = (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as NodeExpressionData;
      return {
        passThrough: content?.config.passThrough || false,
        executionMode: content?.config.executionMode,
      };
    });

    return (
      <GraphNode
        id={id}
        specification={specification}
        name={data.name}
        isSelected={selected}
        actions={[
          <Button key='edit-table' type='text' onClick={() => graphActions.openTab(id)}>
            Edit Expression
          </Button>,
        ]}
        helper={[executionMode === 'loop' && <SyncOutlined />, passThrough && <ArrowRightOutlined />]}
      />
    );
  },
  renderSettings: ({ id }) => {
    const graphActions = useDecisionGraphActions();
    const inputType = useNodeType(id);
    const { contentDiff } = useNodeDiff(id);
    const { fields, disabled } = useDecisionGraphState(({ decisionGraph, disabled }) => {
      const content = (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content?.config;
      return {
        disabled,
        fields: {
          ...content, // 包含所有字段，包括expressions
          version: "v2", // 默认值覆盖
          // 其他默认值
        },
      };
    });

    const updateNode = (data: Partial<NodeExpressionData>) => {
      graphActions.updateNode(id, (draft) => {
        Object.assign(draft.content, data);
        return draft;
      });
    };

    return (
      <div className={'settings-form'}>
        <Form.Item label='Passthrough'>
          <DiffSwitch
            disabled={disabled}
            size={'small'}
            displayDiff={contentDiff?.fields?.passThrough?.status === 'modified'}
            checked={fields?.passThrough}
            previousChecked={contentDiff?.fields?.passThrough?.previousValue}
            onChange={(e) => updateNode({ config: { ...fields, passThrough: e } })}
          />
        </Form.Item>
        <Form.Item label='Input field'>
          <DiffCodeEditor
            variableType={inputType}
            disabled={disabled}
            displayDiff={contentDiff?.fields?.inputField?.status === 'modified'}
            previousValue={contentDiff?.fields?.inputField?.previousValue}
            style={{ fontSize: 12, lineHeight: '20px', width: '100%' }}
            expectedVariableType={fields?.executionMode === 'loop' ? { Array: 'Any' } : undefined}
            maxRows={4}
            value={fields?.inputField ?? ''}
            onChange={(val) => {
              updateNode({ config: { ...fields, inputField: val?.trim() || null } });
            }}
          />
        </Form.Item>
        <Form.Item label='Output path'>
          <DiffInput
            size={'small'}
            readOnly={disabled}
            displayDiff={contentDiff?.fields?.outputPath?.status === 'modified'}
            previousValue={contentDiff?.fields?.outputPath?.previousValue}
            value={fields?.outputPath ?? ''}
            onChange={(e) => updateNode({ config: { ...fields, outputPath: e?.target?.value?.trim() || null } })}
          />
        </Form.Item>
        <Form.Item label='Execution mode'>
          <DiffRadio
            size={'small'}
            disabled={disabled}
            displayDiff={contentDiff?.fields?.executionMode?.status === 'modified'}
            previousValue={contentDiff?.fields?.executionMode?.previousValue}
            value={fields?.executionMode}
            onChange={(e) => updateNode({ config: { ...fields, executionMode: e?.target?.value } })}
            options={[
              {
                value: 'single',
                label: 'Single',
              },
              {
                value: 'loop',
                label: 'Loop',
              },
            ]}
          />
        </Form.Item>
      </div>
    );
  },
};
