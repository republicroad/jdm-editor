// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import React, { useContext, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { requestSchemaFingerprint, writeRequestInputContract } from '../../../../helpers/request-schema';
import {
  DecisionGraphProvider,
  DecisionGraphStoreContext,
  useDecisionGraphActions,
  useDecisionGraphRaw,
  useDecisionGraphState,
} from '../../context/dg-store.context';
import type { DecisionGraphType, DecisionNode } from '../../dg-types';
import type { ContractDriftEvent } from '../fixtures-runner';
import { useRequestDefinitionsEditing } from '../use-request-definitions-editing';
import { useRequestExamplesEditing } from '../use-request-examples-editing';
import { useRequestSchemaEditing } from '../use-request-schema-editing';

type ContextValue = React.ContextType<typeof DecisionGraphStoreContext>;
type DriftEvent = Omit<ContractDriftEvent, 'at'> & { at: string };

let ctx: ContextValue | null = null;
const events: DriftEvent[] = [];
let migrateExample: ((index: number) => void) | null = null;

const Probe: React.FC = () => {
  ctx = useContext(DecisionGraphStoreContext);
  return null;
};

const stubT = (key: string) => key;

/** TabRequest 同款三 hook 组合（渲染 null——hook 级行为测试，不测像素） */
const DriftHarness: React.FC<{ id: string }> = ({ id }) => {
  const graphActions = useDecisionGraphActions();
  const { listenerStore, stateStore } = useDecisionGraphRaw();
  const content = useDecisionGraphState(
    ({ decisionGraph }) => (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content,
  );

  useEffect(() => {
    listenerStore.setState({ onContractEvent: (event) => events.push(event) });
  }, []);

  const schema = useRequestSchemaEditing({ id, type: 'input', content, graphActions });
  const definitions = useRequestDefinitionsEditing({
    id,
    content,
    t: stubT,
    sourceSchemaValue: schema.sourceSchemaValue,
    updateNodeSchema: schema.updateNodeSchema,
  });
  const examples = useRequestExamplesEditing({
    id,
    content,
    t: stubT,
    graphActions,
    simulatorExampleBinding: undefined,
    nodeName: 'Request',
    definitionDrafts: definitions.definitionDrafts,
  });

  useEffect(() => {
    migrateExample = examples.migrateExample;
  }, [examples.migrateExample]);

  void stateStore;
  return null;
};

const renderHarness = (id: string) => {
  render(
    <DecisionGraphProvider>
      <Probe />
      <DriftHarness id={id} />
    </DecisionGraphProvider>,
  );
  if (!ctx) {
    throw new Error('provider context was not captured');
  }
  const context = ctx;
  // provider-only 测试：updateNode 依赖 react-flow nodesState——打桩（Vitest vi 与真函数同形即可）
  act(() => {
    context.referenceStore.setState({
      nodesState: { current: [[], vi.fn(), vi.fn()] } as never,
    });
  });
  return ctx;
};

const inputNodeWith = (content: Record<string, any>): DecisionNode => ({
  id: 'in-1',
  name: 'Request',
  type: 'inputNode',
  position: { x: 0, y: 0 },
  content,
});

const contractContent = (schema: Record<string, unknown>, fingerprint?: string): Record<string, any> => {
  const content: Record<string, any> = {};
  writeRequestInputContract(content, {
    contractVersion: 1,
    schema: schema as any,
    examples: [
      {
        id: 'ex-1',
        name: '正常GOLD用户',
        data: { customer: 'GOLD' },
        ...(fingerprint ? { schemaFingerprint: fingerprint } : {}),
      },
    ],
  });
  return content;
};

describe('输入节点契约漂移事件（ADR-013 批次三 M2 · hook 级）', () => {
  it('schema 变更致已锚定示例漂移 → 发射一次 drift-detected（含示例名与节点）', async () => {
    const schemaV1 = { type: 'object', properties: { customer: { type: 'string' } } };
    const fingerprintV1 = requestSchemaFingerprint(schemaV1);
    const context = renderHarness('in-1');

    const graph: DecisionGraphType = {
      nodes: [inputNodeWith(contractContent(schemaV1, fingerprintV1))],
      edges: [],
    };
    act(() => {
      context.actions.setDecisionGraph(graph);
    });

    // schema V2：新增字段 → 指纹变更
    act(() => {
      context.actions.updateNode('in-1', (draft) => {
        const contract = (draft.content as Record<string, any>).inputContract;
        contract.schema = {
          type: 'object',
          properties: { customer: { type: 'string' }, tier: { type: 'string' } },
        };
        return draft;
      });
    });

    await waitFor(() => expect(events.length).toBe(1));
    expect(events[0].kind).toBe('drift-detected');
    expect(events[0].exampleNames).toEqual(['正常GOLD用户']);
    expect(events[0].nodeId).toBe('in-1');
    expect(events[0].nodeName).toBe('Request');
  });

  it('迁移动作 → 发射 drift-migrated（经 persistExpressions 单漏斗）', async () => {
    const schemaV1 = { type: 'object', properties: { customer: { type: 'string' } } };
    const fingerprintV1 = requestSchemaFingerprint(schemaV1);
    const context = renderHarness('in-1');

    act(() => {
      context.actions.setDecisionGraph({ nodes: [inputNodeWith(contractContent(schemaV1, fingerprintV1))], edges: [] });
    });

    expect(migrateExample).not.toBeNull();
    act(() => {
      migrateExample!(0);
    });

    await waitFor(() => expect(events.some((event) => event.kind === 'drift-migrated')).toBe(true));
    expect(events.find((event) => event.kind === 'drift-migrated')?.exampleNames).toEqual(['正常GOLD用户']);
  });
});
