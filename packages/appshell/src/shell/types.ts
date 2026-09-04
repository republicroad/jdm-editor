import type { DecisionGraphType, Simulation } from '@republicroad/jdm-editor';
import type { AuthAdapter } from '../lib/auth/adapter';
import type { CustomNodeSchemaSource } from '../lib/custom-node-schema-source';
import type { GraphPersistenceAdapter } from './persistence';

export interface ShellSimulateResult {
  simulation: Simulation;
  /** 失败时的人类可读错误摘要(供宿主 toast/提示)；成功时为 undefined */
  errorMessage?: string;
}

export type SimulateHandler = (graph: DecisionGraphType, context: unknown) => Promise<ShellSimulateResult>;

export interface EditorShellOptions {
  /** 自定义节点 schema 来源：默认同源 /api/custom-nodes/schema，可传 URL 或加载函数 */
  schemaSource?: CustomNodeSchemaSource;
  /** 鉴权适配器：默认 anonymous(无用户) */
  authAdapter?: AuthAdapter;
  /** 模拟执行实现：默认同源 POST /api/simulate；宿主可注入本地 WASM 引擎或远程服务 */
  simulate?: SimulateHandler;
  /** 图持久化适配器：未提供时 shell 回退到浏览器本地文件(File System Access API) */
  persistence?: GraphPersistenceAdapter;
}
