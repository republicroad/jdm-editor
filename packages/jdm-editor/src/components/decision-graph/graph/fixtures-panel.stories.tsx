import { type Meta, type StoryObj } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import { expect, fireEvent, waitFor, within } from 'storybook/test';

import { writeRequestInputContract } from '../../../helpers/request-schema';
import { DecisionGraphProvider, useDecisionGraphActions, useDecisionGraphRaw } from '../context/dg-store.context';
import type { DecisionGraphType, DecisionNode, FixturesRunner } from '../index';
import { FixturesPanel } from '../index';

const meta: Meta<typeof FixturesPanel> = {
  title: 'Decision Graph/Input Node/FixturesPanel',
  component: FixturesPanel,
};

export default meta;

type Story = StoryObj<typeof FixturesPanel>;

const buildGraph = (examples: Array<{ name: string; data: Record<string, unknown> }>): DecisionGraphType => {
  const content: Record<string, any> = {};
  writeRequestInputContract(content, {
    contractVersion: 1,
    schema: { type: 'object', properties: { customer: { type: 'string' } } },
    examples: examples.map((example, index) => ({
      id: `ex-${index + 1}`,
      name: example.name,
      data: example.data,
    })),
  });

  const inputNode: DecisionNode = {
    id: 'in-1',
    name: 'Request',
    type: 'inputNode',
    position: { x: 0, y: 0 },
    content,
  };

  return { nodes: [inputNode], edges: [] };
};

/** Harness 捕获的 store 句柄（play 断言用） */
let harness: {
  actions: ReturnType<typeof useDecisionGraphActions>;
  stateStore: ReturnType<typeof useDecisionGraphRaw>['stateStore'];
} | null = null;

/** 装载图 + 注入 runner 的探针：把 store 句柄暴露给 play 断言 */
const Harness: React.FC<{ graph: DecisionGraphType; runner: FixturesRunner }> = ({ graph, runner }) => {
  const graphActions = useDecisionGraphActions();
  const { stateStore } = useDecisionGraphRaw();

  useEffect(() => {
    harness = { actions: graphActions, stateStore };
    graphActions.setDecisionGraph(graph);
    graphActions.setFixturesRunner(runner);
  }, []);

  return <FixturesPanel />;
};

const renderPanel = (graph: DecisionGraphType, runner: FixturesRunner) => (
  <DecisionGraphProvider>
    <div style={{ height: 420 }}>
      <Harness graph={graph} runner={runner} />
    </div>
  </DecisionGraphProvider>
);

export const ReadyAndRun: Story = {
  render: () =>
    renderPanel(
      buildGraph([
        { name: '正常GOLD用户', data: { customer: 'GOLD' } },
        { name: '边界:零金额', data: { customer: 'SILVER' } },
      ]),
      async () => ({
        passed: 1,
        failed: 1,
        results: [
          { name: '正常GOLD用户', passed: true, outcome: 'passed' as const, durationMs: 12 },
          {
            name: '边界:零金额',
            passed: false,
            outcome: 'execution-error' as const,
            error: 'boom',
            durationMs: 8,
          },
        ],
      }),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 头部：唯一 inputNode 名称 + 可用的 Run 按钮（域约束：无选择器）
    await waitFor(() => expect(canvas.getByText('Request')).not.toBeNull());
    const runButton = canvas.getByRole('button', { name: 'Run all' });
    expect(runButton).not.toBeNull();

    // 注意力跟随动作：点击 → running → 报告矩阵（2 行，通过/执行错误分家）
    await fireEvent.click(runButton);
    await waitFor(() => expect(canvas.getAllByText('正常GOLD用户').length).toBeGreaterThan(0));
    expect(canvas.getAllByText('boom').length).toBeGreaterThan(0);
    await waitFor(() => expect(canvas.getAllByText('passed').length).toBeGreaterThan(0));

    // 调试下钻：装载该示例到 simulator（传选择不传状态）
    const debugButtons = canvas.getAllByText('Debug');
    await fireEvent.click(debugButtons[0]!);
    await waitFor(() => {
      expect(harness?.stateStore.getState().simulatorExampleBinding?.nodeId).toBe('in-1');
    });
    expect(harness!.stateStore.getState().simulatorRequest).toContain('GOLD');
  },
};

export const NoExamples: Story = {
  render: () => renderPanel(buildGraph([]), async () => ({ passed: 0, failed: 0, results: [] })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('The input node has no examples yet')).not.toBeNull();
    const runButton = canvas.getByRole('button', { name: 'Run all' });
    expect((runButton as HTMLButtonElement).disabled).toBe(true);
  },
};

export const NoInputNode: Story = {
  render: () => renderPanel({ nodes: [], edges: [] }, async () => ({ passed: 0, failed: 0, results: [] })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('No input node in this graph')).not.toBeNull();
  },
};
