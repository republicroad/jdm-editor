// @vitest-environment jsdom
// DecisionGraph 内部走源码直通（workspace main → src），kernel 的 wasm 加载器
// 经 helpers/wasm 依赖被 mock 的 @gorules/zen-engine-wasm，无需再 mock。
import { DecisionGraph } from '@republicroad/jdm-editor';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLegacyUdfNode } from '../../../lib/custom-node-registry';

vi.mock('@gorules/zen-engine-wasm', () => {
  class VariableType {}
  const init = Object.assign(() => Promise.resolve(), { isReady: () => false });
  return { default: init, isReady: init.isReady, VariableType };
});

// kernel 经 workspace 链接解析到 dist 产物，monaco 是 kernel 的 peerDep、
// appshell 测试环境未安装——桩掉即可（本测试不触达 monaco 代码路径）。
vi.mock('monaco-editor', () => ({}));

afterEach(cleanup);

const legacyUdf = createLegacyUdfNode();

const graph = {
  nodes: [
    {
      id: 'u1',
      type: 'customNode',
      name: '自定义函数（旧版）',
      position: { x: 0, y: 0 },
      content: { kind: legacyUdf.kind, config: {} },
    },
  ],
  edges: [],
};

describe('legacy UDF custom node canvas button', () => {
  it('renders the edit-expression action in the node footer', async () => {
    const { container } = render(
      <DecisionGraph value={graph as never} customNodes={[legacyUdf as never]} onChange={vi.fn()} />,
    );

    await waitFor(() => expect(container.querySelector('.react-flow__node')).toBeInTheDocument());

    await waitFor(() => expect(screen.getByText('Edit Expression')).toBeInTheDocument());
  });
});
