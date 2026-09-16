import type { PipelineEdgeType, PipelineNodeType } from '#components/blocks/flow-3/components/data';
import { PipelineRun } from '#components/blocks/flow-3/components/pipeline-run';
import React, { useCallback, useState } from 'react';

import { type ExecuteTraceResponse, toRunMonitorGraph } from './run-monitor-adapter';

const DEMO_SERVER = import.meta.env.VITE_DEMO_SERVER_URL ?? 'http://localhost:8787';

const btn: React.CSSProperties = {
  padding: '6px 14px',
  cursor: 'pointer',
  border: '1px solid #444',
  borderRadius: 4,
  background: '#2a2a2a',
  color: '#eee',
  whiteSpace: 'nowrap',
};
const area: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  padding: 8,
  background: '#161616',
  border: '1px solid #333',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: 'monospace',
  color: '#ddd',
  resize: 'vertical',
};

type RunGraph = { nodes: PipelineNodeType[]; edges: PipelineEdgeType[] };

/** Run Monitor 页（udf-lab 下半区 tab）：trace → flow-3 运行画布 */
export const RunMonitor: React.FC<{ model: unknown; defaultInput: string }> = ({ model, defaultInput }) => {
  const [inputText, setInputText] = useState(defaultInput);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [runGraph, setRunGraph] = useState<RunGraph | null>(null);
  const [runKey, setRunKey] = useState(0);

  const onRun = useCallback(async () => {
    let input: unknown;
    try {
      input = JSON.parse(inputText);
    } catch (e) {
      setError('input JSON 无效：' + (e instanceof Error ? e.message : String(e)));
      return;
    }
    setRunning(true);
    setError(undefined);
    try {
      const res = await fetch(`${DEMO_SERVER}/v1/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, input, trace: true }),
      });
      const body = (await res.json().catch(() => null)) as ExecuteTraceResponse | null;
      if (!res.ok) {
        setError(`execute ${res.status}: ${(body as { error?: string } | null)?.error ?? 'failed'}`);
        return;
      }
      setRunGraph(toRunMonitorGraph(model as { nodes: []; edges: [] }, body ?? {}));
      setRunKey((k) => k + 1);
    } catch {
      setError('demo-server 不可达（:8787）—— 启动：pnpm demo-server');
    } finally {
      setRunning(false);
    }
  }, [inputText, model]);

  return (
    <div style={{ padding: 12, display: 'grid', gap: 8, gridTemplateRows: 'auto 1fr', height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <button style={btn} onClick={() => void onRun()} disabled={running}>
          {running ? '运行中…' : '▶ 运行（trace）'}
        </button>
        <textarea style={area} value={inputText} onChange={(e) => setInputText(e.target.value)} rows={2} />
        {error && <span style={{ color: '#f85149', fontSize: 12, alignSelf: 'center' }}>{error}</span>}
      </div>
      <div className='pg-monitor-canvas' style={{ minHeight: 0 }}>
        {runGraph ? (
          <PipelineRun key={runKey} initialNodes={runGraph.nodes} initialEdges={runGraph.edges} replay={false} />
        ) : (
          <div style={{ fontSize: 12, opacity: 0.6, padding: 16 }}>点击「运行」后在画布上查看各节点执行状态</div>
        )}
      </div>
    </div>
  );
};
