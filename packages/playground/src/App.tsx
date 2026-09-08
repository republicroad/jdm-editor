import {
  type GraphDiff,
  type GraphPersistenceAdapter,
  VersionHistoryPanel,
  createIndexedDbAdapter,
  restoreVersion,
} from '@republicroad/jdm-appshell';
import { DecisionGraph, DecisionTable, computeGraphDiff } from '@republicroad/jdm-editor';
import React, { useCallback, useState } from 'react';

const adapter: GraphPersistenceAdapter = createIndexedDbAdapter();
const GRAPH_ID = 'playground-graph';

const initialGraph = {
  id: GRAPH_ID,
  name: 'playground',
  nodes: [
    { id: 'in-1', type: 'inputNode', position: { x: 40, y: 160 }, name: 'Request' },
    { id: 'out-1', type: 'outputNode', position: { x: 640, y: 160 }, name: 'Response' },
  ],
  edges: [],
};

const initialTable = {
  hitPolicy: 'first',
  inputs: [{ id: 'in-tier', name: 'Tier', field: 'customer.tier', fieldType: { type: 'string' } }],
  outputs: [{ id: 'out-rate', name: 'Rate', field: 'discount.rate', outputFieldType: { type: 'number' } }],
  rules: [
    { 'id': 'r1', 'in-tier': '"GOLD"', 'out-rate': '0.85' },
    { 'id': 'r2', 'in-tier': '"SILVER"', 'out-rate': '0.9' },
  ],
};

type Page = 'graph' | 'table';
type VersionEntry = { revision: string; versionName?: string; updatedAt?: string; auto?: boolean };

export const App: React.FC = () => {
  const [page, setPage] = useState<Page>('graph');
  const [graph, setGraph] = useState<any>(initialGraph);
  const [table, setTable] = useState<any>(initialTable);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [diffs, setDiffs] = useState<Record<string, GraphDiff>>({});
  const [status, setStatus] = useState('');

  const currentRevision = (graph as { revision?: string }).revision;

  const save = useCallback(async () => {
    try {
      const { id: _id, revision: _rev, ...payload } = graph;
      const { revision } = await adapter.save(
        { ...payload, id: GRAPH_ID, name: 'playground' },
        {
          baseRevision: currentRevision,
        },
      );
      setStatus(`saved ${revision}`);
      setGraph((g: any) => ({ ...g, revision }));
    } catch (err) {
      setStatus(`save failed: ${String(err).slice(0, 80)}`);
    }
  }, [graph]);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setStatus('');
    try {
      const list = (await adapter.listVersions!(GRAPH_ID)) ?? [];
      setVersions(list);

      // P1 面板摘要：相邻版本两两 computeGraphDiff
      const contents = await Promise.all(
        list.map((v) => adapter.load(GRAPH_ID, { revision: v.revision }).then((r) => r?.content ?? null)),
      );
      const next: Record<string, GraphDiff> = {};
      list.forEach((entry, i) => {
        const prev = i > 0 ? contents[i - 1] : null;
        if (contents[i]) {
          next[entry.revision] = computeGraphDiff((prev ?? { nodes: [], edges: [] }) as any, contents[i] as any);
        }
      });
      setDiffs(next);
    } catch (err) {
      setStatus(`history failed: ${String(err).slice(0, 80)}`);
    }
  }, []);

  const onRestore = useCallback(async (revision: string) => {
    const saved = await restoreVersion(adapter, GRAPH_ID, revision);
    const restored = await adapter.load(GRAPH_ID);
    if (restored?.content) {
      setGraph({ ...(restored.content as object), id: GRAPH_ID, revision: saved.revision });
    }
    setStatus(`restored ${revision} → head ${saved.revision}`);
    setHistoryOpen(false);
    void openHistory();
  }, []);

  return (
    <div className='pg-root'>
      <header className='pg-header'>
        <strong>JDM Playground</strong>
        <nav>
          {(['graph', 'table'] as Page[]).map((p) => (
            <button key={p} className={page === p ? 'pg-active' : ''} onClick={() => setPage(p)}>
              {p === 'graph' ? 'Decision Graph' : 'Decision Table'}
            </button>
          ))}
        </nav>
        <div className='pg-actions'>
          <button onClick={() => void save()}>Save (IndexedDB)</button>
          <button onClick={() => void openHistory()}>Version history</button>
          <span className='pg-status'>{status}</span>
        </div>
      </header>

      <main className='pg-main'>
        {page === 'graph' ? (
          <DecisionGraph value={graph} onChange={setGraph} />
        ) : (
          <DecisionTable value={table} onChange={setTable} mode='business' tableHeight='100%' />
        )}
      </main>

      <VersionHistoryPanel
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        versions={versions}
        currentRevision={currentRevision}
        diffs={diffs}
        onRestore={(revision) => void onRestore(revision)}
      />
    </div>
  );
};
