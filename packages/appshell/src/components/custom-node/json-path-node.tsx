import {
  CodeEditor,
  GraphNode,
  type MinimalNodeProps,
  type MinimalNodeSpecification,
  jsonSchemaToVariableType,
  useDecisionGraphActions,
  useDecisionGraphState,
} from '@republicroad/jdm-editor';
import { ListTreeIcon } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '../../components/ui/badge';
import { createSpecNode } from '../../lib/custom-node-registry';
import { uid } from '../../lib/custom-node-registry';
import type { CustomNodeConfig, CustomNodeExpression } from '../../lib/custom-node-types';
import { type JsonPathFields, parseJsonPath, toJsonPathValue } from '../../lib/json-path-protocol';
import PlusCircleIcon from '../../reui/icons/default/outline/plus-circle';
import TrashSquareIcon from '../../reui/icons/default/outline/trash-square';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import css from './custom-node.module.css';
import { LockedCornerBadge } from './locked-corner-badge';

const KIND = 'json_path';

const useNodeConfig = (id: string): CustomNodeConfig | undefined =>
  useDecisionGraphState(({ decisionGraph }) => {
    const config = (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content?.config;
    return config as CustomNodeConfig | undefined;
  });

const nextExprKey = (list: CustomNodeExpression[]): string => {
  const used = new Set(list.map((item) => item.key));
  let index = list.length + 1;
  while (used.has(`result${index}`)) {
    index += 1;
  }
  return `result${index}`;
};

interface JsonPathInstanceEditorProps {
  expr: CustomNodeExpression;
  onChange: (next: CustomNodeExpression) => void;
}

const JsonPathInstanceEditor: React.FC<JsonPathInstanceEditorProps> = ({ expr, onChange }) => {
  const fields: JsonPathFields = parseJsonPath(expr);

  const persistFields = (patch: Partial<JsonPathFields>) => {
    onChange({ ...expr, value: toJsonPathValue({ ...fields, ...patch }) });
  };

  return (
    <div className={css.form}>
      <div className='flex h-8 items-center overflow-hidden rounded-md border border-input bg-transparent dark:bg-input/30'>
        <span className='h-full shrink-0 border-r border-input bg-muted/50 px-2 leading-8 text-xs text-muted-foreground'>
          输出键
        </span>
        <Input
          className='h-8 rounded-none border-0 bg-transparent text-xs shadow-none focus-visible:border-0 focus-visible:ring-0'
          placeholder='result'
          value={expr.key}
          onChange={(event) => onChange({ ...expr, key: event.target.value })}
        />
      </div>
      <span className='text-xs text-muted-foreground'>数据源</span>
      <CodeEditor
        value={fields.inputExpr}
        onChange={(value) => persistFields({ inputExpr: value })}
        placeholder={'如 input.payload 或 { "a": 1 }'}
        maxRows={3}
      />
      <span className='text-xs text-muted-foreground'>JSONPath 表达式（缺 $ 前缀自动补全）</span>
      <Input
        className='h-8 text-xs'
        placeholder={'$.cart.items[*].price'}
        value={fields.pathExpr}
        onChange={(event) => persistFields({ pathExpr: event.target.value })}
      />
      <span className='text-xs text-muted-foreground'>默认值（无命中时回退，可选）</span>
      <CodeEditor
        value={fields.defaultExpr}
        onChange={(value) => persistFields({ defaultExpr: value })}
        placeholder={'如 "n/a" 或 -1'}
        maxRows={1}
      />
    </div>
  );
};

interface JsonPathRowProps {
  index: number;
  expr: CustomNodeExpression;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

const JsonPathRow: React.FC<JsonPathRowProps> = ({ index, expr, selected, onSelect, onRemove }) => {
  const { pathExpr } = parseJsonPath(expr);

  return (
    <div
      className={`${css.listRow}${selected ? ` ${css.listRowSelected}` : ''}${selected ? ' bg-primary/10' : ''}`}
      onClick={onSelect}
    >
      <div className={css.listRowHeader}>
        <span className='text-xs font-medium'>提取 {index + 1}</span>
        <div className={css.listRowActions}>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='h-6 w-6 p-0'
            aria-label='删除提取'
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <TrashSquareIcon />
          </Button>
        </div>
      </div>
      <div className={css.listRowValue}>{pathExpr || '未配置路径'}</div>
    </div>
  );
};

export const JsonPathTab: React.FC<{ id: string }> = ({ id }) => {
  const graphActions = useDecisionGraphActions();
  const config = useNodeConfig(id);
  const expressions = config?.expressions ?? [];
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (selectedIndex >= expressions.length) {
    setSelectedIndex(expressions.length > 0 ? expressions.length - 1 : -1);
  }
  const selected = selectedIndex >= 0 ? expressions[selectedIndex] : undefined;

  const persistExpressions = (next: CustomNodeExpression[]) => {
    const nextConfig: CustomNodeConfig = {
      locked: config?.locked,
      inputField: config?.inputField ?? null,
      outputPath: config?.outputPath ?? null,
      passThrough: config?.passThrough ?? true,
      expressions: next,
    };
    graphActions.updateNode(id, (draft) => {
      draft.content.config = nextConfig;
      return draft;
    });
  };

  const addExtract = () => {
    const next = [
      ...expressions,
      {
        id: uid(),
        key: nextExprKey(expressions),
        value: toJsonPathValue({ inputExpr: '', pathExpr: '$', defaultExpr: '' }),
      },
    ];
    persistExpressions(next);
    setSelectedIndex(next.length - 1);
  };

  const removeExtract = (index: number) => {
    persistExpressions(expressions.filter((_, i) => i !== index));
  };

  return (
    <div className={css.tabSplit}>
      <div className={css.tabList}>
        <div className={css.listRows}>
          {expressions.map((expr, index) => (
            <JsonPathRow
              key={expr.id}
              index={index}
              expr={expr}
              selected={index === selectedIndex}
              onSelect={() => setSelectedIndex(index)}
              onRemove={() => removeExtract(index)}
            />
          ))}
        </div>
        <div className={css.listAdd}>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-7 w-full border-dashed text-xs'
            onClick={addExtract}
          >
            <PlusCircleIcon />
            添加提取
          </Button>
        </div>
      </div>
      <div className={css.tabDetail}>
        {selected ? (
          <div className={css.form}>
            <span className='text-xs text-muted-foreground'>
              提取 {selectedIndex + 1} · 输出键：{selected.key}
            </span>
            <JsonPathInstanceEditor
              key={selected.id}
              expr={selected}
              onChange={(next) => {
                const updated = [...expressions];
                updated[selectedIndex] = next;
                persistExpressions(updated);
              }}
            />
          </div>
        ) : (
          <span className='text-xs text-muted-foreground'>尚未配置提取，点击左侧「添加提取」。</span>
        )}
      </div>
    </div>
  );
};

const JsonPathNode: React.FC<MinimalNodeProps & { specification: MinimalNodeSpecification }> = ({
  id,
  data,
  selected,
  specification,
}) => {
  const graphActions = useDecisionGraphActions();

  const config = useDecisionGraphState(({ decisionGraph }) => {
    return (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content?.config as CustomNodeConfig | undefined;
  });

  const expressions = config?.expressions ?? [];

  return (
    <GraphNode
      id={id}
      specification={specification}
      name={data.name}
      isSelected={selected}
      noBodyPadding
      className='relative'
      actions={[
        <Button
          key='edit-json-path'
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
        <div className={css.rows}>
          {expressions.length === 0 && (
            <div className={css.row}>
              <span className={css.rowValue}>未配置提取</span>
            </div>
          )}
          {expressions.map((expr, index) => {
            const { pathExpr } = parseJsonPath(expr);
            return (
              <div className={css.row} key={expr.id}>
                <span className={css.rowKey}>提取 {index + 1}</span>
                <span className={css.rowValue}>{pathExpr || '未配置路径'}</span>
              </div>
            );
          })}
        </div>
        <div className={css.returns}>
          <span className='text-xs text-muted-foreground'>提取数量</span>
          <span className='text-xs'>{expressions.length}</span>
        </div>
      </div>
    </GraphNode>
  );
};

export const jsonPathNode = createSpecNode({
  kind: KIND,
  displayName: 'JSON 提取',
  group: 'json_path',
  shortDescription: '按 JSONPath 从数据中提取值，支持多个并行提取实例',
  icon: <ListTreeIcon className='size-4' />,
  generateNode: ({ index }) => ({
    name: `${KIND}${index}`,
    config: {
      locked: true,
      inputField: null,
      outputPath: null,
      passThrough: true,
      expressions: [
        {
          id: uid(),
          key: 'result',
          value: toJsonPathValue({ inputExpr: '', pathExpr: '$', defaultExpr: '' }),
        },
      ],
    },
  }),
  renderTab: ({ id }) => <JsonPathTab id={id} />,
  renderNode: JsonPathNode,
  inferTypes: {
    needsUpdate: (content, prevContent) => JSON.stringify(content) !== JSON.stringify(prevContent),
    determineOutputType: ({ input, content }) => {
      let determined = jsonSchemaToVariableType({ type: 'object' });
      const config = (content as { config?: { passThrough?: boolean } } | undefined)?.config;
      if (config?.passThrough) {
        determined = input.merge(determined);
      }
      return determined;
    },
  },
});
