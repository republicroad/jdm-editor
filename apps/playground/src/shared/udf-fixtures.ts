/**
 * Custom Nodes 实例（udf.html）的演示夹具：含 customNode (kind:UDF) 的样例图 + 配套决策输入。
 * 表达式契约：`udf名;;参数表达式...`——参数表达式按位置绑定到 UDF schema 参数序
 * （roster 参数序 = [roster, value]）。roster 夹具依赖 demo-server 注册的 demo 租户名单。
 */

export type UdfFixture = {
  id: string;
  label: string;
  description: string;
  /** Trust Chain 面板的默认决策输入（JSON 文本） */
  inputText: string;
  model: unknown;
};

const edge = (id: string, sourceId: string, targetId: string) => ({ id, type: 'edge', sourceId, targetId });

/** 夹具 A：零参 UDF（current_date）——最小可用闭环 */
const currentDateModel = {
  name: 'current-date-demo',
  nodes: [
    { id: 'in-1', type: 'inputNode', position: { x: 40, y: 160 }, name: 'Request' },
    {
      id: 'udf-1',
      type: 'customNode',
      position: { x: 360, y: 140 },
      name: '当前日期',
      content: {
        kind: 'UDF',
        config: { expressions: [{ id: 'e1', key: 'today', value: 'current_date' }] },
      },
    },
    { id: 'out-1', type: 'outputNode', position: { x: 680, y: 160 }, name: 'Response' },
  ],
  edges: [edge('g1', 'in-1', 'udf-1'), edge('g2', 'udf-1', 'out-1')],
};

/** 夹具 B：roster 名单查询——两位置参数经 zen 表达式取自输入；命中 demo 租户 demo_block 名单 */
const rosterModel = {
  name: 'roster-demo',
  nodes: [
    { id: 'in-1', type: 'inputNode', position: { x: 40, y: 160 }, name: 'Request' },
    {
      id: 'udf-1',
      type: 'customNode',
      position: { x: 360, y: 140 },
      name: '名单核验',
      content: {
        kind: 'UDF',
        config: { expressions: [{ id: 'e1', key: 'hit', value: 'roster;;roster;;value' }] },
      },
    },
    { id: 'out-1', type: 'outputNode', position: { x: 680, y: 160 }, name: 'Response' },
  ],
  edges: [edge('g1', 'in-1', 'udf-1'), edge('g2', 'udf-1', 'out-1')],
};

/** 夹具 C：crypto 摘要——字符串字面量参数（;; 分隔符引号感知） */
const cryptoModel = {
  name: 'crypto-demo',
  nodes: [
    { id: 'in-1', type: 'inputNode', position: { x: 40, y: 160 }, name: 'Request' },
    {
      id: 'udf-1',
      type: 'customNode',
      position: { x: 360, y: 140 },
      name: '摘要计算',
      content: {
        kind: 'UDF',
        config: { expressions: [{ id: 'e1', key: 'digest', value: 'crypto;;text;;"sha256"' }] },
      },
    },
    { id: 'out-1', type: 'outputNode', position: { x: 680, y: 160 }, name: 'Response' },
  ],
  edges: [edge('g1', 'in-1', 'udf-1'), edge('g2', 'udf-1', 'out-1')],
};

export const udfFixtures: UdfFixture[] = [
  {
    id: 'roster',
    label: '名单核验',
    description: 'roster UDF：查询 demo 租户 demo_block 封禁名单（1.2.3.4 命中）',
    inputText: '{\n  "roster": "demo_block",\n  "value": "1.2.3.4"\n}',
    model: rosterModel,
  },
  {
    id: 'current-date',
    label: '当前日期',
    description: 'current_date UDF：零参调用，返回服务器日期',
    inputText: '{}',
    model: currentDateModel,
  },
  {
    id: 'crypto',
    label: '摘要计算',
    description: 'crypto UDF：sha256 摘要（算法为字面量参数）',
    inputText: '{\n  "text": "hello"\n}',
    model: cryptoModel,
  },
];
