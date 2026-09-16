import { useDecisionGraphActions, useDecisionGraphState } from '@republicroad/jdm-editor';
import React from 'react';

import { uid } from '../../lib/custom-node-plans';
import { type CustomFunctionTool, type CustomNodeConfig, type CustomNodeExpression } from '../../lib/custom-node-types';
import { parseOperatorArgs } from '../../lib/http-request-protocol';
import PlusCircleIcon from '../../reui/icons/default/outline/plus-circle';
import TrashSquareIcon from '../../reui/icons/default/outline/trash-square';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type SchemaContainerTabProps = { id: string; tools: CustomFunctionTool[] };

type ToolParam = { key: string; required: boolean; isString: boolean };

/** 位置参数序 = properties 键序；required 标星，string 提示可用字面量 */
const toolParams = (tool: CustomFunctionTool): ToolParam[] => {
  const props = tool.parameters?.properties ?? {};
  const required = new Set(tool.parameters?.required ?? []);
  return Object.entries(props).map(([key, schema]) => ({
    key,
    required: required.has(key),
    isString: (schema as { type?: string } | undefined)?.type === 'string',
  }));
};

const serializeExpr = (func: string, args: string[]): string => [func, ...args].join(';;');

/** 尾部空参截断（引擎侧缺省回退声明默认值）；中段空串占位保留 */
const trimTrailingEmpty = (args: string[]): string[] => {
  const next = [...args];
  while (next.length > 0 && next[next.length - 1].trim() === '') next.pop();
  return next;
};

const nextExprKey = (expressions: CustomNodeExpression[]): string => {
  const taken = new Set(expressions.map((expr) => expr.key));
  let index = expressions.length + 1;
  while (taken.has(`out${index}`)) index += 1;
  return `out${index}`;
};

/**
 * schema 驱动集合容器节点的编辑面板（udf-lab 缺陷修复）：
 * 左列 key 文本框可编辑；右列函数用下拉展示（限定命名空间工具集）；
 * 参数按位置序渲染表达式输入（字面量参数由调用方自带引号）。
 */
export const SchemaContainerTab: React.FC<SchemaContainerTabProps> = ({ id, tools }) => {
  const graphActions = useDecisionGraphActions();
  const config = useDecisionGraphState(({ decisionGraph }) => {
    const found = (decisionGraph?.nodes ?? []).find((node) => node.id === id);
    return found?.content?.config as CustomNodeConfig | undefined;
  });
  const expressions = config?.expressions ?? [];

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

  const toolByName = (name: string): CustomFunctionTool | undefined => tools.find((tool) => tool.name === name);

  const patchExpr = (exprId: string, patch: { key?: string; func?: string; args?: string[] }) => {
    const next = expressions.map((expr) => {
      if (expr.id !== exprId) return expr;
      const parts = parseOperatorArgs(expr.value);
      const func = patch.func ?? parts[0] ?? tools[0]?.name ?? '';
      const args = patch.args ?? parts.slice(1);
      return { ...expr, value: serializeExpr(func, trimTrailingEmpty(args)) };
    });
    // key 单独走 patch.key（避免把 func 序列化误当作整值覆盖）
    const withKey = patch.key ? next.map((expr) => (expr.id === exprId ? { ...expr, key: patch.key! } : expr)) : next;
    persistExpressions(withKey);
  };

  const addExpression = () => {
    const firstTool = tools[0];
    const next = [
      ...expressions,
      {
        id: uid(),
        key: nextExprKey(expressions),
        value: firstTool ? serializeExpr(firstTool.name, []) : '',
      },
    ];
    persistExpressions(next);
  };

  const removeExpression = (exprId: string) => {
    persistExpressions(expressions.filter((expr) => expr.id !== exprId));
  };

  return (
    <div style={{ padding: '10px 12px', display: 'grid', gap: 8, overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '10rem 1fr', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, opacity: 0.6 }}>输出键</span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>函数与参数（位置序）</span>
      </div>
      {expressions.map((expr) => {
        const parts = parseOperatorArgs(expr.value);
        const func = parts[0] ?? '';
        const args = parts.slice(1);
        const tool = toolByName(func);
        const params = tool
          ? toolParams(tool)
          : args.map((_, index) => ({ key: `arg${index + 1}`, required: false, isString: false }));

        const setArg = (index: number, value: string) => {
          const nextArgs = [...args];
          while (nextArgs.length <= index) nextArgs.push('');
          nextArgs[index] = value;
          patchExpr(expr.id, { args: nextArgs });
        };

        return (
          <div
            key={expr.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '10rem minmax(9rem, 12rem) 1fr auto',
              gap: 8,
              alignItems: 'center',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 8,
              background: 'var(--card)',
            }}
          >
            <Input
              className='h-7 px-2 text-xs'
              value={expr.key}
              placeholder='输出键'
              aria-label='输出键'
              onChange={(event) => patchExpr(expr.id, { key: event.target.value })}
            />
            <Select
              value={func}
              onValueChange={(next) => {
                const nextTool = toolByName(next);
                const argCount = nextTool ? Object.keys(nextTool.parameters?.properties ?? {}).length : 0;
                patchExpr(expr.id, { func: next, args: Array.from({ length: argCount }, () => '') });
              }}
            >
              <SelectTrigger className='h-7 text-xs' aria-label='函数'>
                <SelectValue placeholder='选择函数' />
              </SelectTrigger>
              <SelectContent>
                {tools.map((tool) => (
                  <SelectItem key={tool.name} value={tool.name}>
                    {tool.title || tool.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
              {params.map((param, index) => (
                <Input
                  key={param.key}
                  className='h-7 px-2 text-xs min-w-24'
                  style={{ flex: '1 1 8rem' }}
                  value={args[index] ?? ''}
                  placeholder={`${param.key}${param.required ? ' *' : ''}${param.isString ? '（"字面量"）' : ''}`}
                  aria-label={`参数 ${param.key}`}
                  onChange={(event) => setArg(index, event.target.value)}
                />
              ))}
              {params.length === 0 && <span style={{ fontSize: 12, opacity: 0.55 }}>无参数</span>}
            </div>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-7 w-7 p-0'
              aria-label='删除'
              onClick={() => removeExpression(expr.id)}
            >
              <TrashSquareIcon />
            </Button>
          </div>
        );
      })}
      <Button
        type='button'
        variant='outline'
        size='sm'
        className='h-7 w-fit border-dashed text-xs'
        onClick={addExpression}
      >
        <PlusCircleIcon />
        添加调用
      </Button>
    </div>
  );
};
