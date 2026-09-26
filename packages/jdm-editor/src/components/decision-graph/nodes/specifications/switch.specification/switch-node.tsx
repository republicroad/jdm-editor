import { ArrowRightOutlined, DownOutlined } from '#icons';
import clsx from 'clsx';
import React, { useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { P, match } from 'ts-pattern';

import { useNodeType } from '../../../../../helpers/node-type';
import { Button, Dropdown, Typography } from '../../../../primitives';
import { useDecisionGraphActions, useDecisionGraphState } from '../../../context/dg-store.context';
import type { SimulationTrace, SimulationTraceDataSwitch } from '../../../simulator/simulation.types';
import { GraphNode } from '../../graph-node';
import type { MinimalNodeProps, NodeSpecification } from '../specification-types';
import { applyStatementNameToEdges } from './edge-linkage';
import { SwitchHandle, SwitchHandleCompact } from './switch-handle';
import type { NodeSwitchData, SwitchStatement } from './types';

export const SwitchNode: React.FC<
  MinimalNodeProps & {
    specification: Pick<NodeSpecification, 'displayName' | 'icon' | 'documentationUrl'>;
  }
> = ({ id, data, selected, specification }) => {
  const graphActions = useDecisionGraphActions();
  const { ref: inViewRef, inView } = useInView({ delay: 1_000 });
  const { content, disabled, nodeTrace, compactMode, isGraphActive, edges } = useDecisionGraphState(
    ({ decisionGraph, disabled, simulate, compactMode, activeTab }) => ({
      nodeTrace: match(simulate)
        .with({ result: P._ }, ({ result }) => result?.trace?.[id] as SimulationTrace<SimulationTraceDataSwitch>)
        .otherwise(() => null),
      content: (decisionGraph?.nodes || []).find((n) => n?.id === id)?.content as NodeSwitchData | undefined,
      edges: decisionGraph?.edges,
      disabled,
      compactMode,
      isGraphActive: activeTab === 'graph',
    }),
  );

  const nodeType = useNodeType(id, { disabled: !isGraphActive || !inView });
  const statements: SwitchStatement[] = content?.statements || [];
  const hitPolicy = content?.hitPolicy || 'first';

  const changeHitPolicy = (hitPolicy: string) => {
    graphActions.updateNode(id, (node) => {
      node.content.hitPolicy = hitPolicy;
      return node;
    });
  };

  /** WS1-R4 增强：case 名既写入 statement，也镜像到出边 edge.name（分支路径标签芯片的数据源） */
  const changeStatementName = (statementId: string, name: string) => {
    graphActions.updateNode(id, (draft) => {
      const draftStatement = draft.content.statements.find((s: SwitchStatement) => s.id === statementId);
      if (draftStatement) {
        draftStatement.name = name;
      }
      return draft;
    });
    graphActions.setEdges(applyStatementNameToEdges(edges ?? [], id, statementId, name));
  };

  const Handle = useMemo(() => (compactMode ? SwitchHandleCompact : SwitchHandle), [compactMode]);

  return (
    <GraphNode
      id={id}
      ref={inViewRef}
      className={clsx(['h-auto w-[220px] rounded p-0'])}
      specification={specification}
      name={data.name}
      handleRight={false}
      helper={[<ArrowRightOutlined key='arrow-right' />]}
      noBodyPadding
      isSelected={selected}
      actions={[
        <Button
          key='add condition'
          type='text'
          disabled={disabled}
          onClick={() => {
            if (hitPolicy === 'first' && statements?.length > 0) {
              graphActions.updateNode(id, (draft) => {
                draft.content.statements = ((draft.content.statements || []) as SwitchStatement[]).map((statement) => {
                  if (statement.isDefault) {
                    statement.isDefault = false;
                  }
                  return statement;
                });
                draft.content.statements.push({ id: crypto.randomUUID(), condition: '', isDefault: true });
                return draft;
              });
            } else {
              graphActions.updateNode(id, (draft) => {
                draft.content.statements = ((draft.content.statements || []) as SwitchStatement[]).map((statement) => {
                  if (statement.isDefault) {
                    statement.isDefault = false;
                  }
                  return statement;
                });
                draft.content.statements.push({ id: crypto.randomUUID(), condition: '', isDefault: false });
                return draft;
              });
            }
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
      <div className='flex w-full flex-col items-stretch'>
        <div className='nodrag box-border flex w-full flex-col'>
          {!(statements?.length > 0) && (
            <Typography.Text type={'secondary'} className={'px-3'}>
              No conditions
            </Typography.Text>
          )}
          {statements.map((statement, index) => (
            <Handle
              key={statement.id}
              index={index}
              value={statement.condition}
              name={statement.name}
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
              onDelete={() => {
                graphActions.updateNode(id, (draft) => {
                  draft.content.statements = draft.content.statements.filter(
                    (s: SwitchStatement) => s?.id !== statement?.id,
                  );

                  if ((draft.content.statements || []).length === 1) {
                    draft.content.statements = ((draft.content.statements || []) as SwitchStatement[]).map(
                      (statement) => {
                        if (statement.isDefault) {
                          statement.isDefault = false;
                        }
                        return statement;
                      },
                    );
                  }

                  return draft;
                });
                graphActions.removeEdgeByHandleId(statement?.id as string);
              }}
              onChange={(condition) => {
                graphActions.updateNode(id, (draft) => {
                  const draftStatement = draft.content.statements.find((s: SwitchStatement) => {
                    return s.id === statement.id;
                  });

                  draftStatement.condition = condition;
                  return draft;
                });
              }}
              onNameChange={(name) => changeStatementName(statement.id, name)}
            />
          ))}
        </div>
      </div>
    </GraphNode>
  );
};
