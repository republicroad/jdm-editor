import { type GraphPersistenceAdapter, GraphPersistenceError, type GraphRecord } from './persistence';

/**
 * 恢复即前进（restore-is-forward）：将指定历史版本的内容固化为新的 head。
 *
 * 语义：load(revision) 取回历史条目 → 以其 content/session/meta 为基础 save()。
 * 两个适配器的 save 恒定「bump head + 归档旧 head」，因此恢复只追加历史、
 * 永不覆盖其后版本；被恢复的源版本自身也完好保留（本函数不再为其建档）。
 *
 * 宿主的 VersionHistoryPanel.onRestore 可直接调用本函数，无需自行编排。
 *
 * @param opts.versionName 可选：为恢复产生的新 head 命名（透传给 save，
 *   命名版本不受 auto 保留策略治理）。
 * @returns 新 head 的 id 与 revision。
 * @throws GraphPersistenceError('NOT_FOUND') 图或版本不存在时。
 */
export async function restoreVersion(
  adapter: GraphPersistenceAdapter,
  id: string,
  revision: string,
  opts?: { versionName?: string },
): Promise<{ id: string; revision: string }> {
  let record: GraphRecord | null = await adapter.load(id, { revision });
  if (!record) {
    // 请求的 revision 可能就是当前 head：head 尚未归档（仅存在于 headKey），
    // 归档键查询为空时按 head revision 兜底比对。
    const head = await adapter.load(id);
    if (head && head.revision === revision) {
      record = head;
    }
  }
  if (!record) {
    throw new GraphPersistenceError('NOT_FOUND', `version ${revision} of graph ${id} does not exist`);
  }

  const { id: _id, revision: _restoredRevision, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = record;

  const saved = await adapter.save({
    ...(payload as Omit<GraphRecord, 'id' | 'revision' | 'createdAt' | 'updatedAt'>),
    id,
    revision: '',
    ...(opts?.versionName ? { versionName: opts.versionName } : {}),
  });

  return saved;
}
