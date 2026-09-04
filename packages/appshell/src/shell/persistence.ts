import type { TabSnapshot } from '@republicroad/jdm-editor';

export interface GraphRecordMeta {
  /** 宿主侧唯一标识(UUID/slug，由宿主生成) */
  id: string;
  name: string;
  description?: string;
  /** 缺省=共享(复用名单 owner 语义)；宿主服务端注入，客户端传值被剥离 */
  owner?: string;
  tags?: string[];
  /** 图+配置打包：宿主可挂载调度、环境绑定等非图数据 */
  extensions?: Record<string, unknown>;
  /** 当前 head 版本号(宿主生成，单调递增) */
  revision: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GraphRecord extends GraphRecordMeta {
  /** DecisionGraphType(nodes/edges/meta)，由消费方解包 */
  content: unknown;
  /**
   * UI 会话现场（GraphRef.serialize() 的快照：viewport/打开页签/各页签 slice）。
   * 与 content 兄弟存储——历史条目=完整现场快照（1a+4b）；缺省=旧记录降级（跳过 restore）。
   */
  session?: TabSnapshot;
}

export type PersistenceErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'FORBIDDEN';

export class GraphPersistenceError extends Error {
  constructor(
    public code: PersistenceErrorCode,
    message?: string,
  ) {
    super(message);
    this.name = 'GraphPersistenceError';
  }
}

export interface GraphPersistenceAdapter {
  /** 列出当前用户可见的图元数据(head 版本)；未实现则 shell 隐藏「打开」面板 */
  list?(query?: { q?: string }): Promise<GraphRecordMeta[]>;

  /**
   * 加载指定图。
   * @param opts.revision 指定历史版本号；省略则加载 head。
   * @returns null = 不可见或不存在(返回 404 语义，不暴露是否存在)
   */
  load(id: string, opts?: { revision?: string }): Promise<GraphRecord | null>;

  /**
   * 保存(upsert)。
   * @param opts.baseRevision 乐观锁：提供时校验 head 是否匹配，不匹配抛 CONFLICT。
   * @returns 包含分配的 id 与新 revision。
   */
  save(record: GraphRecord, opts?: { baseRevision?: string }): Promise<{ id: string; revision: string }>;

  /** 删除指定图；返回 false = 不可见或不存在(404 语义) */
  delete?(id: string): Promise<boolean>;

  /** 列出指定图的所有历史版本(可选；未实现则 shell 不展示版本历史面板) */
  listVersions?(id: string): Promise<Array<{ revision: string; updatedAt?: string }>>;
}
