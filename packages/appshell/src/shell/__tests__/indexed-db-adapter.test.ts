import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';

import { createIndexedDbAdapter } from '../indexed-db-adapter';

// IndexedDB 全局由 fake-indexeddb 提供（每个测试文件独立数据库实例，
// 同文件内共享——用唯一图 id 隔离用例）
const adapter = createIndexedDbAdapter();

const graph = (name: string) => ({
  nodes: [{ id: 'in', type: 'inputNode', name }],
  edges: [] as Array<Record<string, unknown>>,
});

let seq = 0;
const newId = (): string => `g-${++seq}`;

describe('createIndexedDbAdapter', () => {
  test('新建保存：head v1，无归档', async () => {
    const id = newId();
    const saved = await adapter.save({ id, name: 'n', content: graph('n'), auto: true, revision: '' });
    expect(saved).toEqual({ id, revision: 'v1' });

    const loaded = await adapter.load(id);
    expect(loaded?.revision).toBe('v1');
    expect(loaded?.content).toEqual(graph('n'));
    expect(await adapter.listVersions!(id)).toEqual([]);
  });

  test('更新保存：head 递增 + 旧 head 转版本归档', async () => {
    const id = newId();
    await adapter.save({ id, name: 'n', content: graph('a'), revision: '' });
    const second = await adapter.save({ id, name: 'n2', content: graph('b'), revision: '' });
    expect(second.revision).toBe('v2');

    const head = await adapter.load(id);
    expect(head?.content).toEqual(graph('b'));

    const versions = await adapter.listVersions!(id);
    expect(versions.map((v) => v.revision)).toEqual(['v1']);
    const old = await adapter.load(id, { revision: 'v1' });
    expect(old?.content).toEqual(graph('a'));
  });

  test('load 不存在的 id 返回 null', async () => {
    expect(await adapter.load('nope')).toBeNull();
  });

  test('load 指定不存在的 revision 返回 null', async () => {
    const id = newId();
    await adapter.save({ id, name: 'n', content: graph('x'), revision: '' });
    expect(await adapter.load(id, { revision: 'v99' })).toBeNull();
  });

  test('保留策略：auto 超过 20 条删最旧，manual 全保留', async () => {
    const id = newId();
    await adapter.save({ id, name: 'manual-seed', content: graph('seed'), revision: '' }); // v1 manual
    for (let i = 2; i <= 23; i++) {
      await adapter.save({ id, name: `a${i}`, content: graph(`a${i}`), auto: true, revision: '' }); // v2..v23 auto
    }

    const versions = await adapter.listVersions!(id);
    const autos = versions.filter((v) => v.auto);
    expect(autos).toHaveLength(20); // 保留最近 20 条 auto
    expect(autos.some((v) => v.revision === 'v2')).toBe(false); // 最旧 auto 被治理
    expect(autos.some((v) => v.revision === 'v3')).toBe(true);
    expect(autos.some((v) => v.revision === 'v22')).toBe(true);
    const manual = versions.filter((v) => !v.auto);
    expect(manual.map((v) => v.revision)).toEqual(['v1']); // manual 保留
  });

  test('delete 删除 head 与全部版本归档', async () => {
    const id = newId();
    await adapter.save({ id, name: 'n', content: graph('x'), revision: '' });
    await adapter.save({ id, name: 'n2', content: graph('y'), revision: '' });
    expect(await adapter.delete!(id)).toBe(true);
    expect(await adapter.load(id)).toBeNull();
    expect(await adapter.listVersions!(id)).toEqual([]);
    expect(await adapter.delete!(id)).toBe(false);
  });

  test('list 列出全部 head 元数据（按 updatedAt 倒序）', async () => {
    const a = newId();
    const b = newId();
    await adapter.save({ id: a, name: 'a', content: graph('a'), revision: '' });
    await new Promise((r) => setTimeout(r, 5)); // 保证 updatedAt 时间戳可比较
    await adapter.save({ id: b, name: 'b', content: graph('b'), revision: '' });
    const list = await adapter.list!();
    expect(list.map((g) => g.id)).toContain(a);
    expect(list.map((g) => g.id)).toContain(b);
    expect(list.findIndex((g) => g.id === b)).toBeLessThan(list.findIndex((g) => g.id === a));
  });

  test('meta 字段（description/tags/extensions）经 save→list/load 往返', async () => {
    const id = newId();
    await adapter.save({
      id,
      name: 'n',
      description: 'desc',
      tags: ['prod', 'rules'],
      extensions: { schedule: '0 9 * * *' },
      content: graph('n'),
      revision: '',
    });

    const meta = await adapter.load(id);
    expect(meta).toMatchObject({ description: 'desc', tags: ['prod', 'rules'], extensions: { schedule: '0 9 * * *' } });
    const listed = (await adapter.list!()).find((g) => g.id === id);
    expect(listed).toMatchObject({ description: 'desc', tags: ['prod', 'rules'] });
  });

  test('session 快照随 head 保存并随 load 返回', async () => {
    const id = newId();
    const session = { viewport: { x: 10, y: 20, zoom: 1 }, tabs: { 'tab-1': { activeTab: 'schema' } } };
    await adapter.save({ id, name: 'n', content: graph('n'), session, revision: '' });

    expect(await adapter.load(id)).toMatchObject({ session });
  });

  test('session 快照随版本归档（恢复历史 = 恢复完整现场）', async () => {
    const id = newId();
    await adapter.save({ id, name: 'n', content: graph('a'), session: { tabs: { t: 'old' } }, revision: '' });
    await adapter.save({ id, name: 'n', content: graph('b'), session: { tabs: { t: 'new' } }, revision: '' });

    const restored = await adapter.load(id, { revision: 'v1' });
    expect(restored).toMatchObject({ session: { tabs: { t: 'old' } } });
  });

  test('旧记录（无 session）load 不携带 session 键', async () => {
    const id = newId();
    await adapter.save({ id, name: 'n', content: graph('n'), revision: '' });
    expect(await adapter.load(id)).not.toHaveProperty('session');
  });

  test('load(revision) 返回归档条目自身的 revision 元数据', async () => {
    const id = newId();
    await adapter.save({ id, name: 'n', content: graph('a'), auto: true, revision: '' });
    await adapter.save({ id, name: 'n2', content: graph('b'), revision: '' });

    const old = await adapter.load(id, { revision: 'v1' });
    expect(old?.revision).toBe('v1');
    expect(old?.auto).toBe(true);
  });

  test('内容未变化仍递增 revision', async () => {
    const id = newId();
    const same = graph('stable');
    await adapter.save({ id, name: 'n', content: same, revision: '' });
    const second = await adapter.save({ id, name: 'n', content: same, revision: '' });
    expect(second.revision).toBe('v2');
  });

  test('delete 后重建：revision 从 v1 重新计数', async () => {
    const id = newId();
    await adapter.save({ id, name: 'n', content: graph('a'), revision: '' });
    await adapter.delete!(id);

    const recreated = await adapter.save({ id, name: 'n', content: graph('b'), revision: '' });
    expect(recreated.revision).toBe('v1');
    expect(await adapter.listVersions!(id)).toEqual([]);
  });
});
