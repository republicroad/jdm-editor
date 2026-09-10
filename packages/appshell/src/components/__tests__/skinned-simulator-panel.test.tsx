// @vitest-environment jsdom
// 独立成文件：模拟器面板内容依赖 react-resizable-panels 的组测量，
// 与其他图的挂载同文件连跑时组测量会互相干扰（Run 按钮不再出现）。
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import axios from 'axios';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeContextProvider } from '../../context/theme.provider';
import { createExecuteSimulate } from '../../shell/execute-simulate';
import { SkinnedDecisionGraph } from '../skinned-decision-graph';

vi.mock('@gorules/zen-engine-wasm', () => {
  class VariableType {}
  const init = Object.assign(() => Promise.resolve(), { isReady: () => false });
  return { default: init, isReady: init.isReady, VariableType };
});
vi.mock('monaco-editor', () => ({}));

afterEach(cleanup);

// 命中值取 0.53 —— 模型与画布文案中不存在，只有模拟回灌后才会出现在 DOM
const zenOk = {
  result: { discount: { rate: 0.53 } },
  performance: '6.7ms',
  trace: {
    'dt-1': {
      id: 'dt-1',
      name: 'discount',
      input: { tier: 'GOLD' },
      output: { rate: 0.53 },
      performance: '5ms',
      traceData: { index: 0, rule: { 'in-tier': '"GOLD"' }, reference_map: {} },
    },
  },
};
const graph = { nodes: [], edges: [] };

const realModel = {
  nodes: [
    { id: 'in-1', type: 'inputNode', position: { x: 0, y: 0 }, name: 'Request' },
    {
      id: 'dt-1',
      type: 'decisionTableNode',
      position: { x: 200, y: 0 },
      name: 'discount',
      content: {
        hitPolicy: 'first',
        inputs: [{ id: 'i1', name: 'Tier', field: 'customer.tier', fieldType: { type: 'string' } }],
        outputs: [{ id: 'o1', name: 'Rate', field: 'discount.rate', outputFieldType: { type: 'number' } }],
        rules: [
          { '_id': 'r1', 'in-tier': '"GOLD"', 'out-rate': '0.85' },
          { '_id': 'r2', 'in-tier': '', 'out-rate': '0' },
        ],
        executionMode: 'single',
        passThrough: false,
      },
    },
    { id: 'out-1', type: 'outputNode', position: { x: 400, y: 0 }, name: 'Response' },
  ],
  edges: [
    { id: 'e1', sourceId: 'in-1', targetId: 'dt-1' },
    { id: 'e2', sourceId: 'dt-1', targetId: 'out-1' },
  ],
};

describe('SkinnedDecisionGraph simulator panel', () => {
  it('Run 经 createExecuteSimulate 命中并回灌 Output/Trace', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: zenOk });
    const { container } = render(
      <ThemeContextProvider>
        <SkinnedDecisionGraph
          value={realModel as never}
          onChange={vi.fn()}
          simulateHandler={createExecuteSimulate('http://localhost:8787')}
          defaultActivePanel='simulator'
        />
      </ThemeContextProvider>,
    );

    // Run 按钮是模拟器工具栏中唯一的 primary 图标按钮（无文本）
    const runButton = await waitFor(
      () => {
        const button = container.querySelector('button[class*="primary"]');
        if (!button) throw new Error('run button not mounted yet');
        return button;
      },
      { timeout: 15000, interval: 200 },
    );
    fireEvent.click(runButton);

    // onRun → handler → POST /v1/execute（model=当前图, input=面板上下文, trace 开启）。
    // Output/Trace 的展示是 monaco 编辑器，jsdom mock 下不产文本，故断言调用契约。
    await waitFor(
      () =>
        expect(post).toHaveBeenCalledExactlyOnceWith(
          'http://localhost:8787/v1/execute',
          expect.objectContaining({
            model: expect.objectContaining({ nodes: expect.any(Array) }),
            input: {},
            trace: true,
          }),
        ),
      { timeout: 5000, interval: 200 },
    );
  }, 30000);

  it('未传 simulateHandler：侧栏仅 upload/download（零变化）', async () => {
    const { container } = render(
      <ThemeContextProvider>
        <SkinnedDecisionGraph value={graph as never} onChange={vi.fn()} />
      </ThemeContextProvider>,
    );
    await waitFor(
      () => {
        if (container.querySelectorAll('[class*="grid-area:sidebar"] button').length !== 2) {
          throw new Error('sidebar not settled');
        }
      },
      { timeout: 15000, interval: 200 },
    );
  }, 20000);
});
