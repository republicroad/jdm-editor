import {
  type GraphPersistenceAdapter,
  type SkinDefinition,
  SkinnedDecisionGraph,
  ThemeContextProvider,
  VersionHistoryPanel,
  createExecuteSimulate,
  createGraphsHttpAdapter,
  createIndexedDbAdapter,
  restoreVersion,
  useTheme,
} from '@republicroad/jdm-appshell';
import { type GraphDiff, computeGraphDiff } from '@republicroad/jdm-editor';
import React, { useCallback, useState } from 'react';

import { GRAPH_ID } from './shared/fixtures';
import { ThemeToggle } from './shared/instance-shell';

const DEMO_SERVER = 'http://localhost:8787';
const STORAGE_MODE = new URLSearchParams(window.location.search).get('storage') === 'http' ? 'http' : 'indexeddb';

/** ?storage=http → demo-server /api/graphs；默认 → IndexedDB（本地优先） */
const adapter: GraphPersistenceAdapter =
  STORAGE_MODE === 'http' ? createGraphsHttpAdapter(`${DEMO_SERVER}/api/graphs`) : createIndexedDbAdapter();

type VersionEntry = { revision: string; versionName?: string; pinned?: boolean; updatedAt?: string; auto?: boolean };
type DiffBase = { revision: string; content: unknown };

/** 皮肤切换（S005 P1 演示：default 无 layout 零注入，ocean 注入 host: 工具栏槽位） */
const SkinSwitcher: React.FC = () => {
  const { skins, skinId, setSkinId } = useTheme();
  if (skins.length < 2) {
    return null;
  }
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {skins.map((skin) => (
        <button
          key={skin.id}
          className={skinId === skin.id ? 'pg-active' : ''}
          onClick={() => setSkinId(skin.id)}
          title={`Skin: ${skin.label}`}
        >
          {skin.label}
        </button>
      ))}
    </span>
  );
};

/** Decision Graph 实例（MPA 入口 graph.html）：编辑 + 模拟 + 版本历史 + demo-server 联动 */
export const GraphPlayground: React.FC = () => {
  const [graph, setGraph] = useState<any>({
    id: GRAPH_ID,
    name: 'playground',
    nodes: [
      { id: 'in-1', type: 'inputNode', position: { x: 40, y: 160 }, name: 'Request' },
      { id: 'out-1', type: 'outputNode', position: { x: 640, y: 160 }, name: 'Response' },
    ],
    edges: [],
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [diffs, setDiffs] = useState<Record<string, GraphDiff>>({});
  const [diffBase, setDiffBase] = useState<DiffBase | null>(null);
  const [status, setStatus] = useState('');

  const currentRevision = (graph as { revision?: string }).revision;

  // S005 P1 演示：ocean 皮肤经 layout.toolbar 注入 host: 槽位（规格稿 §10-1 独立组语义）
  const skins: SkinDefinition[] = [
    { id: 'default', label: 'Default' },
    {
      id: 'ocean',
      label: 'Ocean',
      seeds: { primary: '#0284c7' },
      layout: {
        toolbar: {
          slots: {
            'host:toolbar.hello': ({ graph: g, disabled }) => (
              <button
                key='hello'
                onClick={() =>
                  setStatus(`[ocean] hello from toolbar slot — graph has ${(g.nodes ?? []).length} node(s)`)
                }
                disabled={disabled}
                style={disabled ? { opacity: 0.5 } : undefined}
              >
                Ocean action
              </button>
            ),
          },
          order: ['host:toolbar.hello'],
        },
        // S005 P2 演示：右缘面板槽位（Sheet 容器）
        panels: {
          right: {
            slots: {
              'host:panel.notes': ({ graph: g }) => (
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Ocean notes</strong>
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    当前图包含 <strong>{(g.nodes ?? []).length}</strong> 个节点。
                  </p>
                  <p style={{ margin: 0, opacity: 0.7 }}>
                    This panel renders from the skin&rsquo;s layout.panels.right slot (host:panel.notes).
                  </p>
                </div>
              ),
            },
            order: ['host:panel.notes'],
          },
        },
        // S005 P3 演示：头部槽位（ShellHeader，左标题右徽标）
        header: {
          slots: {
            left: () => (
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                🌊 Ocean&nbsp;
                <span style={{ fontWeight: 400, opacity: 0.7 }}>environment</span>
              </span>
            ),
            right: ({ graph: g }) => (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(2, 132, 199, 0.15)',
                  color: '#0369a1',
                }}
              >
                {(g.nodes ?? []).length} nodes
              </span>
            ),
          },
        },
      },
    },
  ];

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
  }, [graph, currentRevision]);

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
  }, [refreshVersions]);

  const onRestore = useCallback(
    async (revision: string) => {
      const saved = await restoreVersion(adapter, GRAPH_ID, revision);
      const restored = await adapter.load(GRAPH_ID);
      if (restored?.content) {
        setGraph({ ...(restored.content as object), id: GRAPH_ID, revision: saved.revision });
      }
      setDiffBase(null);
      setStatus(`restored ${revision} → head ${saved.revision}`);
      setHistoryOpen(false);
      void openHistory();
    },
    [openHistory],
  );

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

  // apps/demo-server 联动：当前图 POST 到本地执行服务（`pnpm dev` 同时拉起两端）
  const onServerExecute = useCallback(async () => {
    const { id: _id, revision: _rev, ...model } = graph;
    try {
      const res = await fetch(`${import.meta.env.VITE_DEMO_SERVER_URL ?? 'http://localhost:8787'}/v1/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, input: {} }),
      });
      const body = (await res.json()) as { result?: unknown; error?: string };
      setStatus(
        res.ok
          ? `server: ${JSON.stringify(body.result ?? null).slice(0, 100)}`
          : `server ${res.status}: ${body.error ?? 'failed'}`,
      );
    } catch (err) {
      setStatus(`server unreachable (:8787): ${String(err).slice(0, 60)}`);
    }
  }, [graph]);

  return (
    <ThemeContextProvider options={{ skins, defaultSkinId: 'default' }}>
      <div className='pg-root'>
        <header className='pg-header'>
          <a className='pg-back' href='./index.html'>
            ← 目录
          </a>
          <strong>Decision Graph</strong>
          {diffBase && (
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
            <button onClick={() => void onServerExecute()} title='POST current graph to apps/demo-server :8787'>
              Server run
            </button>
            <SkinSwitcher />
            <ThemeToggle />
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                color: 'var(--muted-foreground)',
              }}
            >
              {STORAGE_MODE === 'http' ? 'storage: HTTP' : 'storage: IndexedDB'}
            </span>
            <span className='pg-status'>{status}</span>
          </div>
        </header>

        <main className='pg-main'>
          <SkinnedDecisionGraph
            value={graph}
            onChange={setGraph}
            diffBaseline={diffBase ? (diffBase.content as any) : undefined}
            disabled={diffBase ? true : undefined}
            simulateHandler={createExecuteSimulate(import.meta.env.VITE_DEMO_SERVER_URL ?? 'http://localhost:8787')}
          />
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
