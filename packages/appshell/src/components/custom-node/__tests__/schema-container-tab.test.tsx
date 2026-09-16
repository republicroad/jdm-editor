// @vitest-environment jsdom
// SchemaContainerTab 端到端回归：udf-lab 缺陷两则——
// 1) key 文本框不可输入 2) 函数未用下拉展示（回落 legacy JSON 编辑器）。
// 以真实 DecisionGraph 装载 schema 驱动容器节点，驱动交互断言契约。
import { DecisionGraph } from '@republicroad/jdm-editor';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { schemaToCustomNodes } from '../../../lib/custom-node-registry';
import type { CustomNodeNamespace } from '../../../lib/custom-node-types';

vi.mock('@gorules/zen-engine-wasm', () => {
  class VariableType {}
  const init = Object.assign(() => Promise.resolve(), { isReady: () => false });
  return { default: init, isReady: init.isReady, VariableType };
});

vi.mock('monaco-editor', () => ({}));

afterEach(cleanup);

const debugNamespace: CustomNodeNamespace = {
  name: 'debug',
  title: 'debug',
  tools: [
    {
      name: 'inout',
      title: 'inout',
      type: 'function',
      namespace: 'debug',
      kind: 'debug',
      description: '回显输入',
      parameters: {
        type: 'object',
        properties: { value: { type: 'string', title: 'value' } },
        required: ['value'],
      },
      returns: { type: 'object' },
    },
    {
      name: 'func_without_args',
      title: 'func_without_args',
      type: 'function',
      namespace: 'debug',
      kind: 'debug',
      parameters: { type: 'object', properties: {} },
      returns: { type: 'object' },
    },
  ],
};

const containerNodes = schemaToCustomNodes([debugNamespace]);

const graph = {
  nodes: [
    {
      id: 'd1',
      type: 'customNode',
      name: 'debug1',
      position: { x: 0, y: 0 },
      content: {
        kind: 'debug',
        config: {
          inputField: null,
          outputPath: null,
          passThrough: true,
          expressions: [{ id: 'e1', key: 'out1', value: 'inout;;customer.ip' }],
        },
      },
    },
  ],
  edges: [],
};

describe('schema 容器节点编辑面板（缺陷回归）', () => {
  it('key 文本框可编辑并把新键写回节点 config（缺陷 1）', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <DecisionGraph value={graph as never} customNodes={containerNodes as never} onChange={onChange} />,
    );

    await waitFor(() => expect(container.querySelector('.react-flow__node')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Edit Expression'));

    const keyInput = await screen.findByDisplayValue('out1');
    expect(keyInput).not.toHaveAttribute('readonly');
    fireEvent.change(keyInput, { target: { value: 'ip_out' } });

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0] as {
        nodes: Array<{ content: { config: { expressions: Array<{ key: string }> } } }>;
      };
      expect(lastCall?.nodes?.[0]?.content?.config?.expressions?.[0]?.key).toBe('ip_out');
    });
  });

  it('函数以下拉展示且限定命名空间工具集（缺陷 2）', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <DecisionGraph value={graph as never} customNodes={containerNodes as never} onChange={onChange} />,
    );

    await waitFor(() => expect(container.querySelector('.react-flow__node')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Edit Expression'));

    // 当前函数以 trigger 值呈现（inout）
    const trigger = await screen.findByRole('combobox');
    expect(trigger).toHaveTextContent('inout');

    // 打开下拉（radix 在 jsdom 下偶发不响应单击，重试三次）→ 断言命名空间工具均为可选项
    let listbox: HTMLElement | null = null;
    for (let attempt = 0; attempt < 3 && !listbox; attempt += 1) {
      fireEvent.click(trigger);
      try {
        listbox = await waitFor(() => screen.getByRole('listbox'), { timeout: 500 });
      } catch {
        listbox = null;
      }
    }
    expect(listbox, '下拉未打开').not.toBeNull();
    const optionTexts = [...listbox!.querySelectorAll('[role="option"]')].map((o) => o.textContent ?? '');
    expect(
      optionTexts.some((text) => text?.includes('inout')) &&
        optionTexts.some((text) => text?.includes('func_without_args')),
      `下拉选项应包含命名空间工具集，实际: ${JSON.stringify(optionTexts)}`,
    ).toBe(true);
  });
});
