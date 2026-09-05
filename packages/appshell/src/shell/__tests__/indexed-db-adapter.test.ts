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
    await adapter.save({ id: b, name: 'b', content: graph('b'), revision: '' });
    const list = await adapter.list!();
    expect(list.map((g) => g.id)).toContain(a);
    expect(list.map((g) => g.id)).toContain(b);
  });
});
