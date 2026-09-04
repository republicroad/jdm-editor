import {
  GraphNode,
  jsonSchemaToVariableType,
  type MinimalNodeProps,
  type MinimalNodeSpecification,
  useDecisionGraphActions,
  useDecisionGraphState,
  CodeEditor,
} from '@republicroad/jdm-editor';
import { createSpecNode } from '../../lib/custom-node-registry';
import React, { useEffect, useState } from 'react';

import { Autocomplete as AutocompletePrimitive } from '@base-ui/react/autocomplete';
import { parseOperatorArgs, uid } from '../../lib/custom-node-registry';
import type { CustomNodeConfig, CustomNodeExpression } from '../../lib/custom-node-types';
import PlusCircleIcon from '../../reui/icons/default/outline/plus-circle';
import ShieldSearchIcon from '../../reui/icons/default/outline/shield-search';
import TrashSquareIcon from '../../reui/icons/default/outline/trash-square';
import { Alert, AlertDescription, AlertTitle } from '../reui/alert';
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteStatus,
} from '../reui/autocomplete';
import { Badge } from '../reui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import css from './custom-node.module.css';
import { LockedCornerBadge } from './locked-corner-badge';

interface RosterOption {
  name: string;
  size: number;
}

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
};

const quote = (value: string): string => JSON.stringify(value);

const useNodeConfig = (id: string): CustomNodeConfig | undefined =>
  useDecisionGraphState(({ decisionGraph }) => {
    const config = (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content?.config;
    return config as CustomNodeConfig | undefined;
  });

const useRosterOptions = (search: string): { options: RosterOption[]; loading: boolean } => {
  const [options, setOptions] = useState<RosterOption[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/rosters?q=${encodeURIComponent(search)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data) => {
          if (!cancelled && Array.isArray(data)) {
            setOptions(data as RosterOption[]);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setOptions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 200);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [search]);
  return { options, loading };
};

const parseExpr = (expr?: CustomNodeExpression): { roster: string; valueExpr: string } => {
  const args = expr ? parseOperatorArgs(expr.value) : [];
  return {
    roster: args[1] ? unquote(args[1]) : '',
    valueExpr: args[2] ?? '',
  };
};

const toExprValue = (roster: string, valueExpr: string): string[] => ['roster', quote(roster), valueExpr];

const nextExprKey = (list: CustomNodeExpression[]): string => {
  const used = new Set(list.map((item) => item.key));
  let index = list.length + 1;
  while (used.has(`result${index}`)) {
    index += 1;
  }
  return `result${index}`;
};

interface QueryInstanceEditorProps {
  expr: CustomNodeExpression;
  onChange: (next: CustomNodeExpression) => void;
}

const QueryInstanceEditor: React.FC<QueryInstanceEditorProps> = ({ expr, onChange }) => {
  const { roster, valueExpr } = parseExpr(expr);
  const [query, setQuery] = useState(roster);
  const [prevroster, setPrevRoster] = useState(roster);
  if (prevroster !== roster) {
    setPrevRoster(roster);
    setQuery(roster);
  }
  const { options, loading } = useRosterOptions(query);
  const RosterOption = options.find((option) => option.name === roster);

  const handleRosterChange = (value: string, eventDetails: AutocompletePrimitive.Root.ChangeEventDetails) => {
    setQuery(value);
    if (value === '' || eventDetails?.reason === 'item-press' || options.some((option) => option.name === value)) {
      onChange({ ...expr, value: toExprValue(value, valueExpr) });
    }
  };

  return (
    <div className={css.form}>
      <Autocomplete
        items={options}
        value={query}
        onValueChange={handleRosterChange}
        itemToStringValue={(item: unknown) => (item as RosterOption).name}
        filter={null}
        openOnInputClick
      >
        <AutocompleteInput
          size="sm"
          placeholder="搜索并选择名单"
          showClear
          showTrigger
          className="[&[data-slot=autocomplete-input]]:border-transparent [&[data-slot=autocomplete-input]]:bg-transparent [&[data-slot=autocomplete-input]]:px-2"
        />
        <AutocompleteContent>
          <AutocompleteStatus>
            {loading ? '搜索中…' : options.length > 0 ? `${options.length} 个名单` : '未找到匹配名单'}
          </AutocompleteStatus>
          <AutocompleteList>
            {(option: RosterOption) => (
              <AutocompleteItem key={option.name} value={option} className="rounded-lg">
                <span>{option.name}</span>
                <Badge variant="secondary" size="sm" radius="full">
                  {option.size}
                </Badge>
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
      <CodeEditor
        value={valueExpr}
        onChange={(value) => onChange({ ...expr, value: toExprValue(roster, value) })}
        placeholder="Zen 表达式，如 input.phone"
        maxRows={3}
      />
      <div className="flex h-8 items-center overflow-hidden rounded-md border border-input bg-transparent dark:bg-input/30">
        <span className="h-full shrink-0 border-r border-input bg-muted/50 px-2 leading-8 text-xs text-muted-foreground">
          输出键
        </span>
        <Input
          className="h-8 rounded-none border-0 bg-transparent text-xs shadow-none focus-visible:border-0 focus-visible:ring-0"
          placeholder="result"
          value={expr.key}
          onChange={(event) => onChange({ ...expr, key: event.target.value })}
        />
      </div>
      {roster && RosterOption && (
        <Alert variant="info">
          <ShieldSearchIcon />
          <AlertTitle>{`命中名单 ${roster}(${RosterOption.size} 条)`}</AlertTitle>
          <AlertDescription>执行时以服务端名单为准。</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

interface QueryListRowProps {
  index: number;
  expr: CustomNodeExpression;
  selected: boolean;
  hit?: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

const QueryListRow: React.FC<QueryListRowProps> = ({ index, expr, selected, hit, onSelect, onRemove }) => {
  const { roster } = parseExpr(expr);

  return (
    <div
      className={`${css.listRow}${selected ? ` ${css.listRowSelected}` : ''}${selected ? ' bg-primary/10' : ''}`}
      onClick={onSelect}
    >
      <div className={css.listRowHeader}>
        <span className="text-xs font-medium">查询 {index + 1}</span>
        <div className={css.listRowActions}>
          {hit !== undefined && (
            <Badge variant={hit ? 'success' : 'secondary'} size="xs" radius="full">
              {hit ? '命中' : '未命中'}
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            aria-label="删除查询"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <TrashSquareIcon />
          </Button>
        </div>
      </div>
      <div className={css.rosterRowValue}>{roster || '未选择'}</div>
    </div>
  );
};

export const QueryListTab: React.FC<{ id: string }> = ({ id }) => {
  const graphActions = useDecisionGraphActions();
  const config = useNodeConfig(id);
  const output = useDecisionGraphState(({ simulate }) => simulate?.result?.trace?.[id]?.output);
  const expressions = config?.expressions ?? [];
  const outputs = (output ?? {}) as Record<string, { hit?: boolean }>;
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

  const addQuery = () => {
    const next = [...expressions, { id: uid(), key: nextExprKey(expressions), value: toExprValue('', '') }];
    persistExpressions(next);
    setSelectedIndex(next.length - 1);
  };

  const removeQuery = (index: number) => {
    persistExpressions(expressions.filter((_, i) => i !== index));
  };

  return (
    <div className={css.tabSplit}>
      <div className={css.tabList}>
        <div className={css.listRows}>
          {expressions.map((expr, index) => (
            <QueryListRow
              key={expr.id}
              index={index}
              expr={expr}
              selected={index === selectedIndex}
              hit={outputs[expr.key]?.hit}
              onSelect={() => setSelectedIndex(index)}
              onRemove={() => removeQuery(index)}
            />
          ))}
        </div>
        <div className={css.listAdd}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-full border-dashed text-xs"
            onClick={addQuery}
          >
            <PlusCircleIcon />
            添加查询
          </Button>
        </div>
      </div>
      <div className={css.tabDetail}>
        {selected ? (
          <div className={css.form}>
            <span className="text-xs text-muted-foreground">
              查询 {selectedIndex + 1} · 输出键：{selected.key}
            </span>
            <QueryInstanceEditor
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
          <span className="text-xs text-muted-foreground">尚未配置查询，点击左侧「添加查询」。</span>
        )}
      </div>
    </div>
  );
};

const QueryListNode: React.FC<MinimalNodeProps & { specification: MinimalNodeSpecification }> = ({
  id,
  data,
  selected,
  specification,
}) => {
  const graphActions = useDecisionGraphActions();

  const { config, output } = useDecisionGraphState(({ decisionGraph, simulate }) => ({
    config: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content?.config as
      | CustomNodeConfig
      | undefined,
    output: simulate?.result?.trace?.[id]?.output,
  }));

  const expressions = config?.expressions ?? [];
  const outputs = (output ?? {}) as Record<string, { hit?: boolean }>;

  return (
    <GraphNode
      id={id}
      specification={specification}
      name={data.name}
      isSelected={selected}
      noBodyPadding
      className="relative"
      actions={[
        <Button
          key="edit-query-list"
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => graphActions.openTab(id)}
        >
          编辑
        </Button>,
      ]}
    >
      {config?.locked && <LockedCornerBadge />}
      <div className={css.summary}>
        <Badge variant="outline" className="font-mono text-[11px] opacity-75">
          roster
        </Badge>
        <div className={css.rows}>
          {expressions.length === 0 && (
            <div className={css.row}>
              <span className={css.rowValue}>未配置查询</span>
            </div>
          )}
          {expressions.map((expr, index) => {
            const { roster } = parseExpr(expr);
            const hit = outputs[expr.key]?.hit;
            return (
              <div className={css.row} key={expr.id}>
                <span className={css.rowKey}>查询 {index + 1}</span>
                <span className={css.rowValue}>{roster || '未选择'}</span>
                {hit !== undefined ? (
                  <Badge variant={hit ? 'success' : 'secondary'} size="xs" radius="full">
                    {hit ? '命中' : '未命中'}
                  </Badge>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className={css.returns}>
          <span className="text-xs text-muted-foreground">查询次数</span>
          <span className="text-xs">{expressions.length}</span>
        </div>
      </div>
    </GraphNode>
  );
};

export const queryListNode = createSpecNode({
  kind: 'roster',
  displayName: '查询名单',
  group: '风险名单',
  shortDescription: '在服务端名单中查询某个值(支持多个查询实例)',
  icon: <ShieldSearchIcon className="size-4" />,
  generateNode: ({ index }) => ({
    name: `roster${index}`,
    config: {
      locked: true,
      inputField: null,
      outputPath: null,
      passThrough: true,
      expressions: [{ id: uid(), key: 'result', value: toExprValue('', '') }],
    },
  }),
  renderTab: ({ id }) => <QueryListTab id={id} />,
  renderNode: QueryListNode,
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
