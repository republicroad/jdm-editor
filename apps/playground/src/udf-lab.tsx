import { Tabs, TabsContent, TabsList, TabsTrigger } from '#components/ui/tabs';
import {
  EditorShellProvider,
  type GraphPersistenceAdapter,
  SkinnedDecisionGraph,
  createExecuteSimulate,
  createIndexedDbAdapter,
  useEditorShell,
} from '@republicroad/jdm-appshell';
import type { CustomFunctionTool } from '@republicroad/jdm-appshell';
import { setUdfCompletions } from '@republicroad/jdm-editor';
import React, { useCallback, useEffect, useState } from 'react';

import { FunctionCatalog } from './shared/function-catalog';
import { FunctionRepl } from './shared/function-repl';
import { InstanceShell } from './shared/instance-shell';
import { RunMonitor } from './shared/run-monitor';
import { TrustChainPanel } from './shared/trust-chain-panel';
import { udfFixtures } from './shared/udf-fixtures';

const DEMO_SERVER = import.meta.env.VITE_DEMO_SERVER_URL ?? 'http://localhost:8787';
/** 画布图独立 GRAPH_ID：不与 graph 实例的 playground-graph 版本线互相覆盖 */
const GRAPH_ID = 'udf-lab-graph';
const adapter: GraphPersistenceAdapter = createIndexedDbAdapter();

const UdfLabBody: React.FC = () => {
  const { customNodes, schema, ready, runSimulate } = useEditorShell();
  const [graph, setGraph] = useState<any>(udfFixtures[0]?.model);
  const [activeFixture, setActiveFixture] = useState<string>(udfFixtures[0]?.id ?? '');
  const [status, setStatus] = useState('');
  const [serverUp, setServerUp] = useState<boolean | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('trust');
  const [replToolName, setReplToolName] = useState<string | undefined>();

  // WS2 批 1（A2）：schema 到达后把 registry 函数注入全部 zen 表达式编辑器的
  // 补全与悬停文档（内核 completion 模块的模块级注入口）
  useEffect(() => {
    if (schema) {
      setUdfCompletions(schema.flatMap((ns) => ns.tools ?? []));
    }
  }, [schema]);

  // demo-server 健康探针：schema 拉取失败会在 appshell 内静默回退内置样例，
  // 这里显式探测可达性，避免"面板有节点但一执行就失败"的困惑
  useEffect(() => {
    let cancelled = false;
    fetch(`${DEMO_SERVER}/healthz`)
      .then((res) => {
        if (!cancelled) setServerUp(res.ok);
      })
      .catch(() => {
        if (!cancelled) setServerUp(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentFixture = udfFixtures.find((f) => f.id === activeFixture) ?? udfFixtures[0];

  const loadFixture = useCallback((id: string) => {
    const fixture = udfFixtures.find((f) => f.id === id);
    if (!fixture) return;
    setGraph(fixture.model);
    setActiveFixture(fixture.id);
    setStatus(`已载入样例：${fixture.label}`);
  }, []);

  // WS2 批 1（A1）：目录一键插入——customNode 序列化契约与夹具一致
  // （expressions: key=函数名返回键，value='udf名;;参数名...' 位置绑定）
  const insertTool = useCallback((tool: CustomFunctionTool) => {
    setGraph((g: any) => {
      const nodes = g?.nodes ?? [];
      const paramNames = Object.keys(tool.parameters?.properties ?? {});
      const value = paramNames.length ? [tool.name, ...paramNames].join(';;') : tool.name;
      const node = {
        id: crypto.randomUUID(),
        type: 'customNode',
        position: { x: 320, y: 140 + (nodes.length % 6) * 40 },
        name: tool.title ?? tool.name,
        content: {
          kind: 'UDF',
          config: { expressions: [{ id: crypto.randomUUID(), key: tool.name, value }] },
        },
      };
      return { ...g, nodes: [...nodes, node] };
    });
    setCatalogOpen(false);
    setStatus(`已插入 ${tool.name}（连好输入后执行）`);
  }, []);

  const currentRevision = (graph as { revision?: string }).revision;
  const save = useCallback(async () => {
    try {
      // GraphRecord 契约：图文档放 content，meta 平铺 record 顶层
      const { id: _id, revision: _rev, ...doc } = graph;
      const { revision } = await adapter.save(
        { id: GRAPH_ID, name: 'udf-lab', content: doc },
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

  return (
    <InstanceShell
      title='Custom Nodes'
      banner={
        serverUp === false ? (
          <span className='pg-server-down'>
            demo-server 不可达（:8787）—— 自定义节点 schema 已回退内置样例，执行类功能不可用
          </span>
        ) : undefined
      }
      actions={
        <>
          {udfFixtures.map((fixture) => (
            <button
              key={fixture.id}
              className={activeFixture === fixture.id ? 'pg-active' : ''}
              onClick={() => loadFixture(fixture.id)}
              title={fixture.description}
            >
              {fixture.label}
            </button>
          ))}
          <button onClick={() => setCatalogOpen(true)} title='浏览 zen-udf registry 全部函数'>
            目录
          </button>
          <button onClick={() => void save()}>Save (IndexedDB)</button>
          <span className='pg-status'>{status}</span>
        </>
      }
    >
      <div className='pg-split'>
        <div className='pg-split-canvas'>
          <SkinnedDecisionGraph
            value={graph}
            onChange={setGraph}
            customNodes={ready ? customNodes : []}
            simulateHandler={runSimulate}
          />
        </div>
        <div className='pg-split-trust'>
          {/* key = 夹具 id：切换夹具时重挂载面板，默认输入随夹具走；REPL tab 供目录"试运行"跳转 */}
          <Tabs value={panelTab} onValueChange={setPanelTab} className='pg-monitor-tabs'>
            <div style={{ padding: '8px 12px 0' }}>
              <TabsList>
                <TabsTrigger value='trust'>Trust Chain</TabsTrigger>
                <TabsTrigger value='monitor'>Run Monitor</TabsTrigger>
                <TabsTrigger value='repl'>REPL</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value='trust' className='pg-monitor-tabpane'>
              <TrustChainPanel key={activeFixture} model={graph} defaultInput={currentFixture?.inputText} />
            </TabsContent>
            <TabsContent value='monitor' className='pg-monitor-tabpane'>
              <RunMonitor key={activeFixture} model={graph} defaultInput={currentFixture?.inputText ?? '{}'} />
            </TabsContent>
            <TabsContent value='repl' className='pg-monitor-tabpane'>
              <FunctionRepl schema={schema} toolName={replToolName} demoServer={DEMO_SERVER} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <FunctionCatalog
        schema={schema}
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onInsert={insertTool}
        onTry={(tool) => {
          setReplToolName(tool.name);
          setPanelTab('repl');
          setCatalogOpen(false);
          document.querySelector('.pg-split-trust')?.scrollIntoView({ block: 'start' });
        }}
      />
    </InstanceShell>
  );
};

/**
 * Custom Nodes 实例（MPA 入口 udf.html）：editor 项目 decision-simple 页的缩小复刻。
 * EditorShellProvider 四项 options 在仓内的演示消费面：schemaSource（demo-server 端点）、
 * simulate（远程全链路执行）、persistence（IndexedDB）、authAdapter（固定演示用户）。
 */
export const UdfLab: React.FC = () => (
  <EditorShellProvider
    options={{
      schemaSource: `${DEMO_SERVER}/v1/custom-nodes/schema`,
      simulate: createExecuteSimulate(DEMO_SERVER),
      persistence: createIndexedDbAdapter(),
      authAdapter: async () => ({ userId: 'demo-user', displayName: 'Demo User' }),
    }}
  >
    <UdfLabBody />
  </EditorShellProvider>
);
