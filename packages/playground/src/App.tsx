import {
  type GraphDiff,
  type GraphPersistenceAdapter,
  ThemeContextProvider,
  ThemePreference,
  VersionHistoryPanel,
  createIndexedDbAdapter,
  restoreVersion,
  useTheme,
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
type VersionEntry = { revision: string; versionName?: string; pinned?: boolean; updatedAt?: string; auto?: boolean };
type DiffBase = { revision: string; content: unknown };

/** 主题三态循环：auto → dark → light → auto（持久化在 ThemeContextProvider） */
const ThemeToggle: React.FC = () => {
  const { themePreference, setThemePreference } = useTheme();
  const next =
    themePreference === ThemePreference.Automatic
      ? ThemePreference.Dark
      : themePreference === ThemePreference.Dark
        ? ThemePreference.Light
        : ThemePreference.Automatic;
  const label =
    themePreference === ThemePreference.Automatic
      ? 'Auto'
      : themePreference === ThemePreference.Dark
        ? 'Dark'
        : 'Light';
  return (
    <button onClick={() => setThemePreference(next)} title={`Theme: ${label} (click to switch)`}>
      ◐ {label}
    </button>
  );
};

export const App: React.FC = () => {
  const [page, setPage] = useState<Page>('graph');
  const [graph, setGraph] = useState<any>(initialGraph);
  const [table, setTable] = useState<any>(initialTable);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [diffs, setDiffs] = useState<Record<string, GraphDiff>>({});
  const [diffBase, setDiffBase] = useState<DiffBase | null>(null);
  const [status, setStatus] = useState('');

  const currentRevision = (graph as { revision?: string }).revision;

  const save = useCallback(async () => {
    try {
      // GraphRecord 契约：图文档(nodes/edges/…)放 content，meta 字段平铺在 record 顶层
      const { id: _id, revision: _rev, ...doc } = graph;
      const { revision } = await adapter.save(
        { id: GRAPH_ID, name: 'playground', content: doc },
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

  const refreshVersions = useCallback(async () => {
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
  }, []);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setStatus('');
    try {
      await refreshVersions();
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
    setDiffBase(null);
    setStatus(`restored ${revision} → head ${saved.revision}`);
    setHistoryOpen(false);
    void openHistory();
  }, []);

  const onCompare = useCallback(async (revision: string | null) => {
    if (revision === null) {
      setDiffBase(null);
      setStatus('compare exited');
      return;
    }
    try {
      const record = await adapter.load(GRAPH_ID, { revision });
      if (!record?.content) {
        setStatus(`compare failed: ${revision} not found`);
        return;
      }
      setDiffBase({ revision, content: record.content });
      setStatus(`comparing against ${revision}`);
      setHistoryOpen(false);
    } catch (err) {
      setStatus(`compare failed: ${String(err).slice(0, 80)}`);
    }
  }, []);

  const onRename = useCallback(
    async (revision: string, versionName: string | null) => {
      try {
        await adapter.updateVersionMeta?.(GRAPH_ID, revision, { versionName });
        setStatus(versionName ? `named ${revision} → ${versionName}` : `cleared name of ${revision}`);
        await refreshVersions();
      } catch (err) {
        setStatus(`rename failed: ${String(err).slice(0, 80)}`);
      }
    },
    [refreshVersions],
  );

  const onPin = useCallback(
    async (revision: string, pinned: boolean) => {
      try {
        await adapter.updateVersionMeta?.(GRAPH_ID, revision, { pinned });
        setStatus(`${pinned ? 'pinned' : 'unpinned'} ${revision}`);
        await refreshVersions();
      } catch (err) {
        setStatus(`pin failed: ${String(err).slice(0, 80)}`);
      }
    },
    [refreshVersions],
  );

  return (
    <ThemeContextProvider>
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
          {diffBase && page === 'graph' && (
            <span className='pg-compare-banner'>
              Comparing {diffBase.revision}
              <button onClick={() => void onCompare(null)}>Exit compare</button>
            </span>
          )}
          <div className='pg-actions'>
            <button
              onClick={() => void save()}
              disabled={!!diffBase}
              title={diffBase ? 'disabled while comparing' : undefined}
            >
              Save (IndexedDB)
            </button>
            <button onClick={() => void openHistory()}>Version history</button>
            <ThemeToggle />
            <span className='pg-status'>{status}</span>
          </div>
        </header>

        <main className='pg-main'>
          {page === 'graph' ? (
            <DecisionGraph
              value={graph}
              onChange={setGraph}
              diffBaseline={diffBase ? (diffBase.content as any) : undefined}
              disabled={diffBase ? true : undefined}
            />
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
          comparingRevision={diffBase?.revision}
          onRestore={(revision) => void onRestore(revision)}
          onRename={(revision, versionName) => void onRename(revision, versionName)}
          onPin={(revision, pinned) => void onPin(revision, pinned)}
          onCompare={(revision) => void onCompare(revision)}
        />
      </div>
    </ThemeContextProvider>
  );
};
