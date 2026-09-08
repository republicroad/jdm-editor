import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';

import { createIndexedDbAdapter } from '../indexed-db-adapter';
import { restoreVersion } from '../restore';

// IndexedDB 全局由 fake-indexeddb 提供（每个测试文件独立数据库实例）
const adapter = createIndexedDbAdapter();

const graph = (marker: string) => ({
  nodes: [{ id: 'in', type: 'inputNode', name: marker }],
  edges: [] as Array<Record<string, unknown>>,
});

let seq = 0;
const newId = (): string => `g-${++seq}`;

describe('restoreVersion（恢复即前进）', () => {
  test('恢复历史版本 = 固化为新 head，历史完整保留', async () => {
    const id = newId();
    await adapter.save({ id, name: 'v1-content', content: graph('a'), revision: '' }); // v1
    await adapter.save({ id, name: 'v2-content', content: graph('b'), revision: '' }); // v2
    await adapter.save({ id, name: 'v3-content', content: graph('c'), revision: '' }); // v3

    const saved = await restoreVersion(adapter, id, 'v1');
    expect(saved.revision).toBe('v4');

    // 新 head = v1 内容
    const head = await adapter.load(id);
    expect(head?.content).toEqual(graph('a'));

    // 历史不可破坏：v1/v2/v3 归档全部还在
    const versions = await adapter.listVersions!(id);
    expect(versions.map((v) => v.revision)).toEqual(['v1', 'v2', 'v3']);
    expect((await adapter.load(id, { revision: 'v2' }))?.content).toEqual(graph('b'));
  });

  test('恢复产生的新 head 之间继续正常递增', async () => {
    const id = newId();
    await adapter.save({ id, name: 'a', content: graph('a'), revision: '' });
    await restoreVersion(adapter, id, 'v1');
    await restoreVersion(adapter, id, 'v1');

    const head = await adapter.load(id);
    expect(head?.revision).toBe('v3');
  });

  test('versionName 透传给恢复产生的新 head', async () => {
    const id = newId();
    await adapter.save({ id, name: 'a', content: graph('a'), revision: '' });
    await adapter.save({ id, name: 'b', content: graph('b'), revision: '' });

    await restoreVersion(adapter, id, 'v1', { versionName: 'restored-baseline' });
    const head = await adapter.load(id);
    expect(head?.versionName).toBe('restored-baseline');
    // 源版本自身的命名不受影响
    expect((await adapter.listVersions!(id)).find((v) => v.revision === 'v1')?.versionName).toBeUndefined();
  });

  test('恢复当前 head 的 revision：head 回退兜底，产生新 revision', async () => {
    const id = newId();
    await adapter.save({ id, name: 'a', content: graph('a'), revision: '' });

    // head 尚未归档，load(revision) 归档键为空——restoreVersion 应回退到 head
    const saved = await restoreVersion(adapter, id, 'v1');
    expect(saved.revision).toBe('v2');
    expect((await adapter.load(id))?.content).toEqual(graph('a'));
  });

  test('不存在的版本抛 NOT_FOUND', async () => {
    const id = newId();
    await adapter.save({ id, name: 'n', content: graph('a'), revision: '' });
    await expect(restoreVersion(adapter, id, 'v99')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
