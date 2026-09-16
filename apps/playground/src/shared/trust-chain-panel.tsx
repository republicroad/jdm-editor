import React, { useCallback, useMemo, useState } from 'react';

/**
 * Trust Chain 面板：执行（含审计事件）→ 确定性回放 → 影子对比，
 * 把"声明→强制→证据→重演"信任链变成可嵌入的界面段。
 * stateless：不落存储；demo-server 不可达时显式提示（不 mock 数据，DD3/D19）。
 * 消费方：trust.html（模型 = 共享 IndexedDB 已保存图）、udf.html（模型 = 画布实时图）。
 */

const DEMO_SERVER = import.meta.env.VITE_DEMO_SERVER_URL ?? 'http://localhost:8787';

type AuditEvent = {
  decisionId?: string;
  tenantId?: string;
  key?: string;
  rev?: string;
  inputHash?: string;
  output?: unknown;
  asOf?: string;
  processingTime?: string;
  source?: string;
  observed?: Array<{
    key: string;
    name: string;
    semantics?: string;
    outcome?: unknown;
    micros?: number;
    code?: string;
  }>;
  performance?: string;
};

type DiffEntry = { path: string; prod: unknown; shadow: unknown };

const post = async (
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: any; networkError?: string }> => {
  try {
    const res = await fetch(`${DEMO_SERVER}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
  } catch (err) {
    return { ok: false, status: 0, json: null, networkError: err instanceof Error ? err.message : String(err) };
  }
};

const parseJsonSafe = (text: string): { ok: true; value: unknown } | { ok: false; error: string } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const btn: React.CSSProperties = {
  padding: '6px 14px',
  cursor: 'pointer',
  border: '1px solid #444',
  borderRadius: 4,
  background: '#2a2a2a',
  color: '#eee',
};
const card: React.CSSProperties = {
  border: '1px solid #333',
  borderRadius: 6,
  padding: '14px 16px',
  display: 'grid',
  gap: 10,
};
const pre: React.CSSProperties = {
  margin: 0,
  padding: 10,
  background: '#161616',
  borderRadius: 4,
  fontSize: 12,
  overflow: 'auto',
  maxHeight: 320,
  whiteSpace: 'pre-wrap',
};
const area: React.CSSProperties = {
  ...pre,
  minHeight: 90,
  fontFamily: 'monospace',
  color: '#ddd',
};
const label: React.CSSProperties = { fontSize: 12, opacity: 0.7 };
const badge = (ok: boolean): React.CSSProperties => ({
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  background: ok ? '#1c3a24' : '#3a1c1c',
  color: ok ? '#7ee787' : '#f85149',
});

export const TrustChainPanel: React.FC<{ model: unknown; defaultInput?: string }> = ({ model, defaultInput }) => {
  const modelText = useMemo(() => JSON.stringify(model, null, 2), [model]);

  // 第 1 步：执行 + 审计
  const [inputText, setInputText] = useState(defaultInput ?? '{\n  "customer": { "tier": "GOLD" }\n}');
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState<string | undefined>();
  const [result, setResult] = useState<unknown>(undefined);
  const [audit, setAudit] = useState<AuditEvent | undefined>();

  // 第 2 步：回放
  const [replaying, setReplaying] = useState(false);
  const [replay, setReplay] = useState<{ consistent: boolean; result: unknown } | undefined>();
  const [replayError, setReplayError] = useState<string | undefined>();

  // 第 3 步：影子对比
  const [shadowText, setShadowText] = useState('');
  const [shadowing, setShadowing] = useState(false);
  const [shadowError, setShadowError] = useState<string | undefined>();
  const [shadow, setShadow] = useState<{ equivalent: boolean; differences: DiffEntry[] } | undefined>();

  const [networkDown, setNetworkDown] = useState(false);

  const onExecute = useCallback(async () => {
    const parsed = parseJsonSafe(inputText);
    if (!parsed.ok) {
      setExecError('input JSON 无效：' + parsed.error);
      return;
    }
    setExecuting(true);
    setExecError(undefined);
    setAudit(undefined);
    setReplay(undefined);
    const res = await post('/v1/execute', { model, input: parsed.value, trace: true });
    setNetworkDown(res.networkError !== undefined);
    if (res.networkError !== undefined) {
      setExecError('demo-server 不可达（:8787）—— 启动：pnpm demo-server');
      setExecuting(false);
      return;
    }
    if (!res.ok) {
      setExecError(`execute ${res.status}: ${(res.json as { error?: string })?.error ?? 'failed'}`);
      setExecuting(false);
      return;
    }
    setResult(res.json?.result);
    setAudit(res.json?.audit);
    setExecuting(false);
  }, [inputText, model]);

  const onReplay = useCallback(async () => {
    if (!audit) return;
    const parsed = parseJsonSafe(inputText);
    if (!parsed.ok) {
      setReplayError('input JSON 无效：' + parsed.error);
      return;
    }
    setReplaying(true);
    setReplayError(undefined);
    const res = await post('/v1/replay', { model, input: parsed.value, audit });
    if (res.networkError !== undefined) {
      setReplayError('demo-server 不可达（:8787）');
      setReplaying(false);
      return;
    }
    if (!res.ok) {
      setReplayError(
        `replay ${res.status}: ${(res.json as { error?: string })?.error ?? 'failed'}${(res.json as { details?: string })?.details ? ' — ' + (res.json as { details?: string }).details : ''}`,
      );
      setReplaying(false);
      return;
    }
    setReplay({ consistent: res.json?.consistent === true, result: res.json?.result });
    setReplaying(false);
  }, [audit, inputText, model]);

  const onShadowCompare = useCallback(async () => {
    const shadowParsed = parseJsonSafe(shadowText);
    if (!shadowParsed.ok) {
      setShadowError('shadow 模型 JSON 无效：' + shadowParsed.error);
      return;
    }
    const parsed = parseJsonSafe(inputText);
    if (!parsed.ok) {
      setShadowError('input JSON 无效：' + parsed.error);
      return;
    }
    setShadowing(true);
    setShadowError(undefined);
    const res = await post('/v1/shadow', {
      prodModel: model,
      shadowModel: shadowParsed.value,
      input: parsed.value,
    });
    if (res.networkError !== undefined) {
      setShadowError('demo-server 不可达（:8787）');
      setShadowing(false);
      return;
    }
    if (!res.ok) {
      setShadowError(`shadow ${res.status}: ${(res.json as { error?: string })?.error ?? 'failed'}`);
      setShadowing(false);
      return;
    }
    setShadow({ equivalent: res.json?.equivalent === true, differences: res.json?.differences ?? [] });
    setShadowing(false);
  }, [inputText, model, shadowText]);

  return (
    <div style={{ padding: '16px', maxWidth: 900, margin: '0 auto', display: 'grid', gap: 20 }}>
      {networkDown && (
        <div style={card}>
          <strong style={{ color: '#f85149' }}>demo-server 不可达（:8787）</strong>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            启动命令：仓库根目录执行 <code>pnpm demo-server</code>。本页不使用 mock 数据。
          </div>
        </div>
      )}
      {/* 第 1 步：执行 + 审计事件 */}
      <section style={card}>
        <h3 style={{ margin: 0, fontSize: 14 }}>① 执行并捕获审计事件</h3>
        <div>
          <div style={label}>决策输入（JSON）</div>
          <textarea
            style={{ ...area, width: '100%' }}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={4}
          />
        </div>
        <div>
          <button style={btn} onClick={() => void onExecute()} disabled={executing}>
            {executing ? '执行中…' : '▶ 执行（trace + audit）'}
          </button>
        </div>
        {execError && <div style={{ color: '#f85149', fontSize: 13 }}>{execError}</div>}
        {result !== undefined && (
          <>
            <div>
              <div style={label}>决策结论</div>
              <pre style={pre}>{JSON.stringify(result, null, 2)}</pre>
            </div>
            {audit && (
              <div>
                <div style={label}>
                  审计事件 · decisionId <code>{audit.decisionId?.slice(0, 18)}</code> · inputHash{' '}
                  <code>{audit.inputHash?.slice(0, 16)}…</code> · {audit.processingTime}
                </div>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                      <th style={{ padding: '4px 8px' }}>UDF</th>
                      <th style={{ padding: '4px 8px' }}>语义</th>
                      <th style={{ padding: '4px 8px' }}>耗时(µs)</th>
                      <th style={{ padding: '4px 8px' }}>code</th>
                      <th style={{ padding: '4px 8px' }}>outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(audit?.observed ?? []).map((o, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #333' }}>
                        <td style={{ padding: '4px 8px' }}>{o.name}</td>
                        <td style={{ padding: '4px 8px' }}>{o.semantics}</td>
                        <td style={{ padding: '4px 8px' }}>{o.micros}</td>
                        <td style={{ padding: '4px 8px' }}>{o.code ?? 'ok'}</td>
                        <td style={{ padding: '4px 8px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {JSON.stringify(o.outcome)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* 第 2 步：确定性回放 */}
      <section style={{ ...card, opacity: audit ? 1 : 0.45 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>② 确定性回放（observe/act 读审计 journal，query 以 asOf 重算）</h3>
        <div>
          <button style={btn} onClick={() => void onReplay()} disabled={!audit || replaying}>
            {replaying ? '回放中…' : '↻ 回放并核验一致性'}
          </button>
        </div>
        {replayError && <div style={{ color: '#f85149', fontSize: 13 }}>{replayError}</div>}
        {replay && (
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={badge(replay.consistent)}>
              {replay.consistent ? 'CONSISTENT — 与历史结论一致' : 'DIVERGED — 与历史结论不一致'}
            </span>
            <pre style={pre}>{JSON.stringify(replay.result, null, 2)}</pre>
          </div>
        )}
      </section>

      {/* 第 3 步：影子对比 */}
      <section style={card}>
        <h3 style={{ margin: 0, fontSize: 14 }}>③ 影子对比（新 rev 灰度：act 影子侧 intent 占位，不双次处置）</h3>
        <div>
          <div style={label}>候选模型（JSON，与左侧当前模型对比）</div>
          <textarea
            style={{ ...area, width: '100%', minHeight: 140 }}
            value={shadowText}
            onChange={(e) => setShadowText(e.target.value)}
            placeholder={modelText.slice(0, 400) + (modelText.length > 400 ? '…' : '')}
            rows={6}
          />
        </div>
        <div>
          <button style={btn} onClick={() => void onShadowCompare()} disabled={shadowing}>
            {shadowing ? '对比中…' : '⇄ 影子对比'}
          </button>
        </div>
        {shadowError && <div style={{ color: '#f85149', fontSize: 13 }}>{shadowError}</div>}
        {shadow && (
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={badge(shadow.equivalent)}>
              {shadow.equivalent ? 'EQUIVALENT — 可切流' : 'DIVERGED — 存在差异'}
            </span>
            {shadow.differences.length > 0 && (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                    <th style={{ padding: '4px 8px' }}>path</th>
                    <th style={{ padding: '4px 8px' }}>prod</th>
                    <th style={{ padding: '4px 8px' }}>shadow</th>
                  </tr>
                </thead>
                <tbody>
                  {shadow.differences.map((d, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #333' }}>
                      <td style={{ padding: '4px 8px' }}>{d.path}</td>
                      <td style={{ padding: '4px 8px' }}>{JSON.stringify(d.prod)}</td>
                      <td style={{ padding: '4px 8px' }}>{JSON.stringify(d.shadow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {/* 第 4 步：证据 */}
      {audit && (
        <section style={card}>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>审计事件 JSON（凭证形态，可复制交存）</summary>
            <pre style={pre}>{JSON.stringify(audit, null, 2)}</pre>
          </details>
        </section>
      )}
    </div>
  );
};
