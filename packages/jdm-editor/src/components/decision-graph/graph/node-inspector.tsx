import { CloseOutlined } from '#icons';
import { Badge } from '#reui/badge';
import { IconTile } from '#reui/icon-tile';
import { Panel, useOnSelectionChange } from '@xyflow/react';
import React from 'react';

import { Button } from '../../primitives';
import { useDecisionGraphState } from '../context/dg-store.context';
import { nodeSpecification } from '../nodes/specifications/specifications';

/**
 * WS1-R5：停靠式检查器（flow-2 docked inspector 模式）。
 * 选中带 renderSettings 的节点时，画布右上停靠展示该节点的设置面板；
 * 关闭仅收起面板，重新选择节点即再次打开。
 */
export const NodeInspector: React.FC = () => {
  const [selected, setSelected] = React.useState<{ id: string; type: string; kind?: string; name?: string } | null>(
    null,
  );
  const [closed, setClosed] = React.useState(false);
  const customNodes = useDecisionGraphState(({ customNodes }) => customNodes);

  useOnSelectionChange({
    onChange: ({ nodes }) => {
      const first = nodes[nodes.length - 1];
      if (!first) {
        setSelected(null);
        return;
      }
      setSelected({
        id: first.id,
        type: String(first.type ?? ''),
        kind: typeof first.data?.kind === 'string' ? first.data.kind : undefined,
        name: typeof first.data?.name === 'string' ? first.data.name : undefined,
      });
      setClosed(false);
    },
  });

  if (!selected || closed) {
    return null;
  }

  const specification =
    selected.type === 'customNode'
      ? customNodes.find((c) => c.kind === selected.kind)
      : (nodeSpecification as Record<string, unknown>)[selected.type];
  const Settings = (specification as { renderSettings?: React.ComponentType<{ id: string }> } | undefined)
    ?.renderSettings;

  if (!Settings) {
    return null;
  }

  return (
    <Panel position='top-right' style={{ margin: 10, maxWidth: 320, width: 'max-content' }}>
      <div
        className='nodrag nopan flex max-h-[60vh] w-72 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--grl-color-bg-container)] shadow-md'
        data-slot='node-inspector'
      >
        <div className='flex items-center gap-2 border-b border-b-[var(--border)] p-2'>
          <IconTile variant='soft' size='xs' aria-hidden>
            {(specification as { icon?: React.ReactNode } | undefined)?.icon}
          </IconTile>
          <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
            <span className='truncate text-xs font-medium'>{selected.name}</span>
            {selected.type !== 'customNode' && (
              <Badge variant='secondary' size='xs' className='w-fit max-w-full truncate'>
                {String((specification as { displayName?: React.ReactNode } | undefined)?.displayName ?? '')}
              </Badge>
            )}
          </div>
          <Button
            type='text'
            size='small'
            className='h-6 w-6 p-0'
            aria-label='Close inspector'
            icon={<CloseOutlined style={{ fontSize: 10 }} />}
            onClick={() => setClosed(true)}
          />
        </div>
        <div className='flex flex-col gap-1 overflow-y-auto p-2.5 [&_.settings-form_.grl-ce]:text-xs'>
          <Settings id={selected.id} />
        </div>
      </div>
    </Panel>
  );
};
