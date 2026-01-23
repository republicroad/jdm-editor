import { PlayCircleOutlined } from '@ant-design/icons';
import type { DragDropManager } from 'dnd-core';
import React from 'react';
import { Button, theme } from 'antd';

import type { ExpressionPermission } from '../../request-table/context/expression-store.context';
import { Expression } from '../../request-table';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { fJson } from '../../../helpers/utility';

export type TabRequestProps = {
  id: string;
  manager?: DragDropManager;
  menuList?: any[];
  type?: string;
  onRunNode?: () => void;
  runLoading?: boolean;
};

export const TabRequest: React.FC<TabRequestProps> = ({ id, manager, menuList, type, onRunNode, runLoading }) => {
  const { token } = theme.useToken();
  const graphActions = useDecisionGraphActions();
  const { disabled, configurable, content } = useDecisionGraphState(({ disabled, configurable, decisionGraph }) => ({
    disabled,
    configurable,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content,
  }));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      {onRunNode && (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${token.colorBorder}`,
            backgroundColor: token.colorBgContainer,
          }}
        >
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={runLoading}
            onClick={onRunNode}
            size="small"
          >
            运行到此节点
          </Button>
        </div>
      )}

      {/* 编辑区 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Expression
          value={content ? content.inputs : ''}
          onChange={(val) => {
            graphActions.updateNode(id, (draft) => {
              if (!draft.content) {
                draft.content = { inputs: val };
              } else {
                draft.content.inputs = val;
              }
              return draft;
            });
            graphActions.setSimulatorRequest(fJson(val))
          }}
          disabled={disabled}
          configurable={configurable}
          manager={manager}
          menuList={menuList}
        />
      </div>
    </div>
  );
};

