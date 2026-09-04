import {
  GraphNode,
  type MinimalNodeProps,
  type MinimalNodeSpecification,
  jsonSchemaToVariableType,
  useDecisionGraphActions,
  useDecisionGraphState,
} from '@republicroad/jdm-editor';
import { CalendarDaysIcon } from 'lucide-react';
import React from 'react';

import { createSpecNode } from '../../lib/custom-node-registry';
import { uid } from '../../lib/custom-node-registry';
import type { CustomNodeConfig } from '../../lib/custom-node-types';
import { Badge } from '../reui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import css from './custom-node.module.css';
import { LockedCornerBadge } from './locked-corner-badge';

const KIND = 'current_date';

const useNodeConfig = (id: string): CustomNodeConfig | undefined =>
  useDecisionGraphState(({ decisionGraph }) => {
    const config = (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content?.config;
    return config as CustomNodeConfig | undefined;
  });

const outputKeyOf = (config: CustomNodeConfig | undefined): string => config?.expressions?.[0]?.key ?? 'result';

type CurrentDateTabProps = { id: string };

/** 专属页面：输出 key 可由客户输入 + 仿真结果回显 */
export const CurrentDateTab: React.FC<CurrentDateTabProps> = ({ id }) => {
  const graphActions = useDecisionGraphActions();
  const config = useNodeConfig(id);
  const commitKey = (next: string) => {
    graphActions.updateNode(id, (draft) => {
      const cfg = draft.content.config as CustomNodeConfig;
      if (cfg.expressions?.[0]) {
        cfg.expressions[0].key = next;
      }
      return draft;
    });
  };
  const key = outputKeyOf(config);
  const output = useDecisionGraphState(({ simulate }) => simulate?.result?.trace?.[id]?.output) as
    | Record<string, unknown>
    | undefined;

  const value = output?.[key];

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='text-xs leading-5 text-muted-foreground'>
        返回服务器当前日期（本地时区，YYYY-MM-DD 格式）。函数无参数，输出写入下方 key。
      </div>

      <div className='flex items-center gap-2'>
        <span className='w-16 shrink-0 text-xs text-muted-foreground'>输出 key</span>
        <Input
          className='h-8 w-56 font-mono text-xs'
          defaultValue={key}
          onBlur={(event) => commitKey(event.target.value.trim())}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>

      {output !== undefined && output !== null ? (
        <div className='rounded-lg border bg-muted/40 p-4'>
          <div className='text-xs text-muted-foreground'>仿真输出</div>
          <div className='mt-1 font-mono text-2xl font-semibold'>
            {value !== undefined && value !== null ? String(value) : '—'}
          </div>
        </div>
      ) : (
        <div className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>运行仿真查看结果</div>
      )}
    </div>
  );
};

type CurrentDateNodeProps = MinimalNodeProps & { specification: MinimalNodeSpecification };

const CurrentDateNode: React.FC<CurrentDateNodeProps> = ({ id, data, selected, specification }) => {
  const graphActions = useDecisionGraphActions();
  const config = useNodeConfig(id);
  const key = outputKeyOf(config);
  const output = useDecisionGraphState(({ simulate }) => simulate?.result?.trace?.[id]?.output) as
    | Record<string, unknown>
    | undefined;

  const value = output?.[key];

  return (
    <GraphNode
      id={id}
      className='relative'
      specification={specification}
      name={data.name}
      isSelected={selected}
      noBodyPadding
      actions={[
        <Button
          key='edit-current-date'
          type='button'
          variant='ghost'
          size='sm'
          className='h-7 px-2.5 text-xs'
          onClick={() => graphActions.openTab(id)}
        >
          编辑
        </Button>,
      ]}
    >
      {config?.locked && <LockedCornerBadge />}
      <div className={css.summary}>
        <Badge variant='outline' className='font-mono text-[11px] opacity-75'>
          {KIND}
        </Badge>
        <div className={css.row}>
          <span className={css.rowKey}>{key || 'result'}</span>
          <span className={css.rowValue}>{value !== undefined && value !== null ? String(value) : '运行仿真查看'}</span>
        </div>
      </div>
    </GraphNode>
  );
};

export const currentDateNode = createSpecNode({
  kind: KIND,
  displayName: '当前日期',
  group: 'debugui',
  shortDescription: '返回服务器当前日期（本地时区，YYYY-MM-DD）',
  icon: <CalendarDaysIcon className='size-4' />,
  generateNode: ({ index }) => ({
    name: `${KIND}${index}`,
    config: {
      locked: true,
      inputField: null,
      outputPath: null,
      passThrough: true,
      expressions: [{ id: uid(), key: 'result', value: [KIND] }],
    },
  }),
  renderTab: ({ id }) => <CurrentDateTab id={id} />,
  renderNode: CurrentDateNode,
  inferTypes: {
    needsUpdate: (content, prevContent) => JSON.stringify(content) !== JSON.stringify(prevContent),
    determineOutputType: ({ input, content }) => {
      let determined = jsonSchemaToVariableType({ type: 'string' });
      const config = (content as { config?: { passThrough?: boolean } } | undefined)?.config;
      if (config?.passThrough) {
        determined = input.merge(determined);
      }
      return determined;
    },
  },
});
