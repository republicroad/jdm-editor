import { DecisionGraph, type DecisionGraphType } from '@republicroad/jdm-editor';
import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';

import { useCustomNodes } from '../hooks/useCustomNodes';
import type { GraphPersistenceAdapter, GraphRecord } from '../shell/persistence';

/**
 * Cross-package integration: kernel DecisionGraph + appshell custom nodes
 * (useCustomNodes) + an in-memory GraphPersistenceAdapter — the scheme D
 * kernel/shell contract exercised end to end.
 */
const meta: Meta = {
  title: 'Integration/Kernel + Appshell',
  parameters: {
    controls: { disable: true },
    docs: { disable: true },
  },
};

export default meta;

type Story = StoryObj;

const memoryStore = new Map<string, { record: GraphRecord; revision: string; versions: string[] }>();

const persistence: GraphPersistenceAdapter = {
  async list() {
    return [...memoryStore.entries()].map(([id, v]) => ({
      id,
      name: (v.record.name as string) ?? id,
      revision: v.revision,
    }));
  },
  async load(id: string) {
    const hit = memoryStore.get(id);
    if (!hit) return null;
    return {
      id,
      name: (hit.record.name as string) ?? id,
      revision: hit.revision,
      content: hit.record,
    };
  },
  async save(record: GraphRecord, opts?: { baseRevision?: string }) {
    const id = record.id ?? 'graph-1';
    const hit = memoryStore.get(id);
    if (opts?.baseRevision && hit && hit.revision !== opts.baseRevision) {
      throw new Error('CONFLICT');
    }
    const revision = `r${(hit?.versions.length ?? 0) + 1}`;
    const versions = [...(hit?.versions ?? []), revision];
    memoryStore.set(id, { record, revision, versions });
    return { id, revision };
  },
  async delete(id: string) {
    return memoryStore.delete(id);
  },
  async listVersions(id: string) {
    return (memoryStore.get(id)?.versions ?? []).map((revision) => ({ revision }));
  },
};

const IntegrationGraph: React.FC = () => {
  const { customNodes, ready } = useCustomNodes();
  const [graph, setGraph] = useState<DecisionGraphType>(() => ({
    id: 'integration-demo',
    name: 'integration-demo',
    nodes: [
      { id: 'in-1', type: 'inputNode', position: { x: 60, y: 220 }, name: 'Request' },
      { id: 'out-1', type: 'outputNode', position: { x: 700, y: 220 }, name: 'Response' },
    ],
    edges: [],
  }));
  void persistence;

  if (!ready) {
    return <div style={{ padding: 24 }}>loading custom nodes…</div>;
  }

  return (
    <div style={{ height: '100%' }}>
      <DecisionGraph value={graph} customNodes={customNodes} onChange={(next) => setGraph(next)} />
    </div>
  );
};

export const KernelPlusAppshell: Story = {
  render: () => <IntegrationGraph />,
};
