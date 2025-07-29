import { ArrowRightOutlined, BookOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons';
import { Button, Form, Modal, Typography } from 'antd';
import { produce } from 'immer';
import _ from 'lodash';
import { ArrowRightToLineIcon } from 'lucide-react';
import React from 'react';
import type { z } from 'zod';

import { useNodeType } from '../../../../helpers/node-type';
import { platform } from '../../../../helpers/platform';
import { type inputNodeSchema } from '../../../../helpers/schema';
import { DiffInput, DiffRadio, DiffSwitch } from '../../../shared';
import { DiffCodeEditor } from '../../../shared/diff-ce';
import { SpacedText } from '../../../spaced-text';
import { useDecisionGraphActions, useDecisionGraphState, useNodeDiff } from '../../context/dg-store.context';
import type { Diff, DiffMetadata } from '../../dg-types';
import { compareAndUnifyLists, compareStringFields } from '../../diff/comparison';
import { TabRequest } from '../../graph/tab-request';
import { GraphNode } from '../graph-node';
import { NodeColor } from './colors';
import type { NodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';

type InferredContent = z.infer<typeof inputNodeSchema>['content'];

export type NodeInputData = Omit<InferredContent, 'expressions'> &
  Diff & {
    expressions: (InferredContent['expressions'][0] & Diff)[];
  };

export const inputSpecification: NodeSpecification<NodeInputData> = {
  type: NodeKind.Input,
  icon: <ArrowRightToLineIcon size='1em' />,
  displayName: 'Request',
  color: NodeColor.Green,
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions',
  shortDescription: 'Provides input context',
  generateNode: () => ({
    name: 'request',
    content: {
      schema: '',
      expressions: [],
      passThrough: false,
      inputField: null,
      outputPath: null,
      executionMode: 'single' as const,
    },
  }),
  renderTab: ({ id, manager }) => <TabRequest id={id} manager={manager} type={'input'} />,
  renderNode: ({ id, data, selected, specification }) => {
    const graphActions = useDecisionGraphActions();
    const { disabled, passThrough, executionMode } = useDecisionGraphState(({ disabled, decisionGraph }) => {
      const content = (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as NodeInputData;
      return {
        disabled,
        passThrough: content?.passThrough || false,
        executionMode: content?.executionMode,
      };
    });

    return (
      <GraphNode
        id={id}
        specification={specification}
        name={data.name}
        isSelected={selected}
        handleLeft={false}
        helper={[executionMode === 'loop' && <SyncOutlined />, passThrough && <ArrowRightOutlined />]}
        actions={[
          <Button key='edit-table' type='text' onClick={() => graphActions.openTab(id)}>
            Edit Request
          </Button>,
        ]}
        menuItems={[
          // {
          //   key: 'documentation',
          //   icon: <BookOutlined />,
          //   label: 'Documentation',
          //   onClick: () => window.open(specification.documentationUrl, '_href'),
          // },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            danger: true,
            label: <SpacedText left='Delete' right={platform.shortcut('Backspace')} />,
            disabled,
            onClick: () =>
              Modal.confirm({
                icon: null,
                title: 'Delete node',
                content: (
                  <Typography.Text>
                    Are you sure you want to delete <Typography.Text strong>{data.name}</Typography.Text> node.
                  </Typography.Text>
                ),
                okButtonProps: { danger: true },
                onOk: () => graphActions.removeNodes([id]),
              }),
          },
        ]}
      />
    );
  },
  // renderSettings: ({ id }) => {
  //   const graphActions = useDecisionGraphActions();
  //   const inputType = useNodeType(id);
  //   const { contentDiff } = useNodeDiff(id);
  //   const { fields, disabled } = useDecisionGraphState(({ decisionGraph, disabled }) => {
  //     const content = (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as NodeInputData;
  //     return {
  //       disabled,
  //       fields: {
  //         passThrough: content?.passThrough || false,
  //         inputField: content?.inputField,
  //         outputPath: content?.outputPath,
  //         executionMode: content?.executionMode || 'single',
  //       },
  //     };
  //   });

  //   const updateNode = (data: Partial<NodeInputData>) => {
  //     graphActions.updateNode(id, (draft) => {
  //       Object.assign(draft.content, data);
  //       return draft;
  //     });
  //   };

  //   return (
  //     <div className={'settings-form'}>
  //       <Form.Item label='Passthrough'>
  //         <DiffSwitch
  //           disabled={disabled}
  //           size={'small'}
  //           displayDiff={contentDiff?.fields?.passThrough?.status === 'modified'}
  //           checked={fields?.passThrough}
  //           previousChecked={contentDiff?.fields?.passThrough?.previousValue}
  //           onChange={(e) => updateNode({ passThrough: e })}
  //         />
  //       </Form.Item>
  //       <Form.Item label='Input field'>
  //         <DiffCodeEditor
  //           variableType={inputType}
  //           disabled={disabled}
  //           displayDiff={contentDiff?.fields?.inputField?.status === 'modified'}
  //           previousValue={contentDiff?.fields?.inputField?.previousValue}
  //           style={{ fontSize: 12, lineHeight: '20px', width: '100%' }}
  //           expectedVariableType={fields?.executionMode === 'loop' ? { Array: 'Any' } : undefined}
  //           maxRows={4}
  //           value={fields?.inputField ?? ''}
  //           onChange={(val) => {
  //             updateNode({ inputField: val?.trim() || null });
  //           }}
  //         />
  //       </Form.Item>
  //       <Form.Item label='Output path'>
  //         <DiffInput
  //           size={'small'}
  //           readOnly={disabled}
  //           displayDiff={contentDiff?.fields?.outputPath?.status === 'modified'}
  //           previousValue={contentDiff?.fields?.outputPath?.previousValue}
  //           value={fields?.outputPath ?? ''}
  //           onChange={(e) => updateNode({ outputPath: e?.target?.value?.trim() || null })}
  //         />
  //       </Form.Item>
  //       <Form.Item label='Execution mode'>
  //         <DiffRadio
  //           size={'small'}
  //           disabled={disabled}
  //           displayDiff={contentDiff?.fields?.executionMode?.status === 'modified'}
  //           previousValue={contentDiff?.fields?.executionMode?.previousValue}
  //           value={fields?.executionMode}
  //           onChange={(e) => updateNode({ executionMode: e?.target?.value })}
  //           options={[
  //             {
  //               value: 'single',
  //               label: 'Single',
  //             },
  //             {
  //               value: 'loop',
  //               label: 'Loop',
  //             },
  //           ]}
  //         />
  //       </Form.Item>
  //     </div>
  //   );
  // },
  getDiffContent: (current, previous): any => {
    const newContent = produce(current, (draft) => {
      const fields: DiffMetadata['fields'] = {};

      if ((current?.schema || '')?.trim?.() !== (previous?.schema || '')?.trim?.()) {
        _.set(fields, 'schema', {
          previousValue: previous?.schema || '',
          status: 'modified',
        });
      }

      if ((current.executionMode || 'single') !== (previous.executionMode || 'single')) {
        _.set(fields, 'executionMode', {
          status: 'modified',
          previousValue: previous.executionMode,
        });
      }

      if (!compareStringFields(current.inputField, previous.inputField)) {
        _.set(fields, 'inputField', {
          status: 'modified',
          previousValue: previous.inputField,
        });
      }

      if (!compareStringFields(current.outputPath, previous.outputPath)) {
        _.set(fields, 'outputPath', {
          status: 'modified',
          previousValue: previous.outputPath,
        });
      }

      if ((current.passThrough || false) !== (previous.passThrough || false)) {
        _.set(fields, 'passThrough', {
          status: 'modified',
          previousValue: previous.passThrough,
        });
      }

      const expressions = compareAndUnifyLists(current?.expressions || [], previous?.expressions || [], {
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
};
