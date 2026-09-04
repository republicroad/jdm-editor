import {
  CodeEditor,
  GraphNode,
  jsonSchemaToVariableType,
  type MinimalNodeProps,
  type MinimalNodeSpecification,
  useDecisionGraphActions,
  useDecisionGraphState,
} from '@republicroad/jdm-editor';
import { createSpecNode } from '../../lib/custom-node-registry';
import { ReplaceIcon } from 'lucide-react';
import React, { useState } from 'react';

import { uid } from '../../lib/custom-node-registry';
import { parseOperatorArgs, quote, unquote } from '../../lib/http-request-protocol';
import type { CustomNodeConfig, CustomNodeExpression } from '../../lib/custom-node-types';
import PlusCircleIcon from '../../reui/icons/default/outline/plus-circle';
import TrashSquareIcon from '../../reui/icons/default/outline/trash-square';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { KeyValueEditor } from './key-value-editor';
import css from './custom-node.module.css';
import { Badge } from '../../components/ui/badge';
import { LockedCornerBadge } from './locked-corner-badge';

const KIND = 'template';
const TEMPLATE_UDF = 'template';

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

interface TemplateFields {
  templateExpr: string;
  varsExpr: string;
}

const parseTemplate = (expr?: CustomNodeExpression): TemplateFields => {
  const args = expr ? parseOperatorArgs(expr.value) : [];
  return {
    templateExpr: unquote(args[1] ?? ''),
    varsExpr: args[2] ?? '',
  };
};

/** 变长尾参:vars 末尾空值截断;模板恒以字符串字面量序列化 */
const toTemplateValue = (fields: TemplateFields): string[] => {
  const tail = [fields.varsExpr];
  let end = tail.length;
  while (end > 0 && tail[end - 1].trim() === '') {
    end -= 1;
  }
  return [TEMPLATE_UDF, quote(fields.templateExpr), ...tail.slice(0, end)];
};

interface TemplateInstanceEditorProps {
  expr: CustomNodeExpression;
  onChange: (next: CustomNodeExpression) => void;
}

const TemplateInstanceEditor: React.FC<TemplateInstanceEditorProps> = ({ expr, onChange }) => {
  const fields = parseTemplate(expr);

  const persistFields = (patch: Partial<TemplateFields>) => {
    onChange({ ...expr, value: toTemplateValue({ ...fields, ...patch }) });
  };

  return (
    <div className={css.form}>
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
      <span className="text-xs text-muted-foreground">模板内容（{'${path}'} 插值，缺失变量替换为空串）</span>
      <CodeEditor
        value={fields.templateExpr}
        onChange={(value) => persistFields({ templateExpr: value })}
        placeholder={'如 "您好 ${user.name}，您的订单 ${order.id} 已发货"'}
        maxRows={4}
      />
      <KeyValueEditor
        label="插值变量"
        addLabel="添加变量"
        deleteLabel="删除变量"
        valuePlaceholder="表达式，如 input.user"
        rawPlaceholder="{ name: input.user.name }"
        value={fields.varsExpr}
        onChange={(next) => persistFields({ varsExpr: next })}
      />
    </div>
  );
};

interface TemplateRowProps {
  index: number;
  expr: CustomNodeExpression;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

const TemplateRow: React.FC<TemplateRowProps> = ({ index, expr, selected, onSelect, onRemove }) => {
  const { templateExpr } = parseTemplate(expr);
  const preview = templateExpr.length > 24 ? `${templateExpr.slice(0, 24)}…` : templateExpr;

  return (
    <div
      className={`${css.listRow}${selected ? ` ${css.listRowSelected}` : ''}${selected ? ' bg-primary/10' : ''}`}
      onClick={onSelect}
    >
      <div className={css.listRowHeader}>
        <span className="text-xs font-medium">模板 {index + 1}</span>
        <div className={css.listRowActions}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            aria-label="删除模板"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <TrashSquareIcon />
          </Button>
        </div>
      </div>
      <div className={css.listRowValue}>{preview || '空模板'}</div>
    </div>
  );
};

export const TemplateTab: React.FC<{ id: string }> = ({ id }) => {
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

  const addTemplate = () => {
    const next = [
      ...expressions,
      {
        id: uid(),
        key: nextExprKey(expressions),
        value: toTemplateValue({ templateExpr: '', varsExpr: '' }),
      },
    ];
    persistExpressions(next);
    setSelectedIndex(next.length - 1);
  };

  const removeTemplate = (index: number) => {
    persistExpressions(expressions.filter((_, i) => i !== index));
  };

  return (
    <div className={css.tabSplit}>
      <div className={css.tabList}>
        <div className={css.listRows}>
          {expressions.map((expr, index) => (
            <TemplateRow
              key={expr.id}
              index={index}
              expr={expr}
              selected={index === selectedIndex}
              onSelect={() => setSelectedIndex(index)}
              onRemove={() => removeTemplate(index)}
            />
          ))}
        </div>
        <div className={css.listAdd}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-full border-dashed text-xs"
            onClick={addTemplate}
          >
            <PlusCircleIcon />
            添加模板
          </Button>
        </div>
      </div>
      <div className={css.tabDetail}>
        {selected ? (
          <div className={css.form}>
            <span className="text-xs text-muted-foreground">
              模板 {selectedIndex + 1} · 输出键：{selected.key}
            </span>
            <TemplateInstanceEditor
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
          <span className="text-xs text-muted-foreground">尚未配置模板，点击左侧「添加模板」。</span>
        )}
      </div>
    </div>
  );
};

const TemplateNode: React.FC<MinimalNodeProps & { specification: MinimalNodeSpecification }> = ({
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
      className="relative"
      actions={[
        <Button
          key="edit-template"
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
          {KIND}
        </Badge>
        <div className={css.rows}>
          {expressions.length === 0 && (
            <div className={css.row}>
              <span className={css.rowValue}>未配置模板</span>
            </div>
          )}
          {expressions.map((expr, index) => {
            const { templateExpr } = parseTemplate(expr);
            const preview = templateExpr.length > 18 ? `${templateExpr.slice(0, 18)}…` : templateExpr;
            return (
              <div className={css.row} key={expr.id}>
                <span className={css.rowKey}>模板 {index + 1}</span>
                <span className={css.rowValue}>{preview || '空模板'}</span>
              </div>
            );
          })}
        </div>
        <div className={css.returns}>
          <span className="text-xs text-muted-foreground">模板数量</span>
          <span className="text-xs">{expressions.length}</span>
        </div>
      </div>
    </GraphNode>
  );
};

export const templateNode = createSpecNode({
  kind: KIND,
  displayName: '模板渲染',
  group: 'template',
  shortDescription: '渲染 ${var} 插值模板字符串，支持多个并行模板实例',
  icon: <ReplaceIcon className="size-4" />,
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
          value: toTemplateValue({ templateExpr: '', varsExpr: '' }),
        },
      ],
    },
  }),
  renderTab: ({ id }) => <TemplateTab id={id} />,
  renderNode: TemplateNode,
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
