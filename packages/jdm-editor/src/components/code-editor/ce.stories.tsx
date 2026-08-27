import { syntaxTree } from '@codemirror/language';
import { Variable, createVariableType, generateAst, generateAstUnary } from '@gorules/zen-engine-wasm';
import type { SyntaxNodeRef } from '@lezer/common';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { Typography } from '../primitives';
import React, { useMemo, useState } from 'react';
import { match } from 'ts-pattern';

import { CodeEditor, type CodeEditorProps } from './ce';
import { CodeEditorPreview } from './ce-preview';

const meta: Meta<typeof CodeEditor> = {
  title: 'CodeEditor',
  component: CodeEditor,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    value: { type: 'string' },
    maxRows: { type: 'number' },
    disabled: { type: 'boolean' },
    placeholder: { type: 'string' },
    type: { control: { type: 'radio' }, options: ['standard', 'unary', 'template'] },
    strict: { control: 'boolean' },
    variableType: { control: { type: 'object' } },
    expectedVariableType: { control: { type: 'object' } },
    noStyle: { control: 'boolean' },
    onChange: { table: { disable: true } },
    onBlur: { table: { disable: true } },
    onFocus: { table: { disable: true } },
    lazy: { control: 'boolean' },
  },
  args: {
    maxRows: 3,
    placeholder: 'Type expression...',
    type: 'standard',
    disabled: false,
    strict: false,
    onChange: fn(),
    onBlur: fn(),
    onFocus: fn(),
    variableType: {
      customer: {
        firstName: 'John',
        lastName: 'Doe',
        groups: ['admin'],
      },
      cart: {
        totals: 100,
        items: [
          { id: 1, qty: 2, price: 20 },
          { id: 2, qty: 1, price: 50 },
        ],
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof CodeEditor>;

export const Uncontrolled: Story = {};

export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState('');

    return <CodeEditor {...args} value={value} onChange={setValue} />;
  },
};

export const FullHeight: Story = {
  args: {
    fullHeight: true,
  },
  decorators: [
    (Story) => (
      <div style={{ height: 200 }}>
        <Story />
      </div>
    ),
  ],
};

export const NoStyle: Story = {
  args: {
    noStyle: true,
  },
  decorators: [
    (Story) => (
      <>
        <p>Parent border</p>
        <div style={{ border: '1px solid blue' }}>
          <Story />
        </div>
      </>
    ),
  ],
};

/**
 * Regression guard for the two cell-editing bugs fixed in 2026-08:
 *   1. Single click must enter edit mode (a regression made it double-click).
 *   2. Display (CodeHighlighter) ↔ edit (CodeMirror) must be pixel-aligned;
 *      drift was caused by CM runtime-injected unlayered styles beating the
 *      layered skin (see docs/codemirror-theme-migration.md).
 * Runs under `pnpm --filter @gorules/jdm-editor test:storybook`.
 */
export const LazyParity: Story = {
  args: {
    lazy: true,
    value: "customer.firstName == 'John' && cart.totals > 50",
  },
  play: async ({ canvasElement }) => {
    type Snapshot = { content: { x: number; y: number; padding: string }; line: { x: number; y: number; padding: string } };

    const snapshot = (scope: Element): Snapshot => {
      const measure = (el: HTMLElement | null) => {
        if (!el) throw new Error('missing editor part');
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, padding: getComputedStyle(el).padding };
      };
      return {
        content: measure(scope.querySelector<HTMLElement>('.cm-content')),
        line: measure(scope.querySelector<HTMLElement>('.cm-line')),
      };
    };

    // Deterministic DISPLAY state bootstrap: the Storybook dev canvas can
    // auto-run this play() or autofocus the tab before we sample, which would
    // leave the editor already mounted in edit mode. Force-blur resets lazy
    // editors back to the highlighter (internal onBlur chain).
    let highlighter = canvasElement.querySelector<HTMLElement>('.grl-ce-highlighter');
    if (!highlighter) {
      (document.activeElement as HTMLElement | null)?.blur?.();
      await waitFor(
        () => expect(canvasElement.querySelector('.grl-ce-highlighter')).not.toBeNull(),
        { timeout: 5_000 },
      );
      highlighter = canvasElement.querySelector<HTMLElement>('.grl-ce-highlighter');
    }
    expect(highlighter).not.toBeNull();
    const before = snapshot(highlighter!);

    // ONE click must be enough — failing here means the mousedown→edit handoff
    // regressed back to requiring a second click.
    await userEvent.click(highlighter!.querySelector<HTMLElement>('.cm-content')!);

    await waitFor(
      () => expect(canvasElement.querySelector('.grl-ce:not(.grl-ce-highlighter)')).not.toBeNull(),
      { timeout: 5_000 },
    );

    const editor = canvasElement.querySelector('.grl-ce:not(.grl-ce-highlighter)');
    const after = snapshot(editor!);

    for (const part of ['content', 'line'] as const) {
      expect(Math.abs(after[part].x - before[part].x), `${part}.x parity`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(after[part].y - before[part].y), `${part}.y parity`).toBeLessThanOrEqual(0.5);
      expect(after[part].padding, `${part} padding parity`).toBe(before[part].padding);
    }
  },
};

export const Debug: StoryObj<
  CodeEditorProps & { showEditorState: boolean; showParserState: boolean; showTypeInfo: boolean }
> = {
  args: {
    showTypeInfo: false,
    showParserState: false,
    showEditorState: false,
  },
  argTypes: {
    showTypeInfo: {
      control: 'boolean',
      description: 'Toggle type info visibility',
    },
    showParserState: {
      control: 'boolean',
      description: 'Toggle parser state visibility',
    },
    showEditorState: {
      control: 'boolean',
      description: 'Toggle editor state visibility',
    },
  },
  render: (args) => {
    const token = { marginMD: 16, colorBgLayout: 'var(--grl-color-bg-layout)', colorBorder: 'var(--grl-color-border)', borderRadiusOuter: 8, paddingSM: 12 };
    const [editorState, setEditorState] = useState('');
    const [parserState, setParserState] = useState('');
    const [typeInfo, setTypeInfo] = useState('');

    const vt = useMemo(() => {
      return createVariableType(args.variableType);
    }, [args.variableType]);

    return (
      <>
        <CodeEditor
          {...args}
          onChange={(expression) => {
            const ast = match(args.type)
              .with('standard', () => generateAst(expression))
              .with('unary', () => generateAstUnary(expression))
              .otherwise(() => null);

            setParserState(ast ?? '');

            const typeInfo = match(args.type)
              .with('unary', () => vt.typeCheckUnary(expression))
              .otherwise(() => vt.typeCheck(expression));
            setTypeInfo(JSON.stringify(typeInfo, undefined, 2));
          }}
          onStateChange={(state) => {
            const nodes: string[] = [];
            syntaxTree(state).iterate({
              enter(node: SyntaxNodeRef): boolean | void {
                nodes.push(
                  `${node.name}[${node.from}:${node.to}] = ${node.type.isError}, ${node.node.tree?.children.length}`,
                );
              },
            });

            setEditorState(JSON.stringify(nodes, undefined, 2));
          }}
        />
        {args.showTypeInfo && (
          <div style={{ marginTop: token.marginMD }}>
            <Typography.Text>Type Info (ZEN)</Typography.Text>
            <div
              style={{
                background: token.colorBgLayout,
                border: `1px solid ${token.colorBorder}`,
                borderRadius: token.borderRadiusOuter,
                padding: token.paddingSM,
              }}
            >
              <Typography.Text style={{ whiteSpace: 'pre', fontFamily: 'monospace' }}>{typeInfo}</Typography.Text>
            </div>
          </div>
        )}

        {args.showParserState && (
          <div style={{ marginTop: token.marginMD }}>
            <Typography.Text>Parser state (ZEN)</Typography.Text>
            <div
              style={{
                background: token.colorBgLayout,
                border: `1px solid ${token.colorBorder}`,
                borderRadius: token.borderRadiusOuter,
                padding: token.paddingSM,
              }}
            >
              <Typography.Text style={{ whiteSpace: 'pre', fontFamily: 'monospace' }}>{parserState}</Typography.Text>
            </div>
          </div>
        )}

        {args.showEditorState && (
          <div style={{ marginTop: token.marginMD }}>
            <Typography.Text>Editor state (CodeMirror)</Typography.Text>
            <div
              style={{
                background: token.colorBgLayout,
                border: `1px solid ${token.colorBorder}`,
                borderRadius: token.borderRadiusOuter,
                padding: token.paddingSM,
              }}
            >
              <Typography.Text style={{ whiteSpace: 'pre', fontFamily: 'monospace' }}>{editorState}</Typography.Text>
            </div>
          </div>
        )}
      </>
    );
  },
};

export const LivePreview: StoryObj<
  CodeEditorProps & {
    noPreviewText: string;
    initialExpression: string;
    initialResult: unknown;
  }
> = {
  args: {
    noPreviewText: 'Run simulation to see the results',
    initialExpression: 'customer.firstName + " " + customer.lastName',
    initialResult: 'John Doe',
  },
  argTypes: {
    noPreviewText: { type: 'string' },
    initialExpression: { type: 'string' },
    initialResult: { control: { type: 'object' } },
  },
  render: ({ noPreviewText, initialResult, initialExpression, variableType, ...args }) => {
    const [expression, setExpression] = useState(initialExpression);

    const inputData = useMemo(() => {
      return new Variable(variableType);
    }, [variableType]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CodeEditor {...args} variableType={variableType} onChange={setExpression} value={expression} />
        <CodeEditorPreview
          expression={expression}
          noPreviewText={noPreviewText}
          inputData={inputData}
          initial={{ expression: initialExpression, result: initialResult }}
        />
      </div>
    );
  },
};
