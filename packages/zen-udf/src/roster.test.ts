import { describe, expect, test } from 'vitest';

import { deleteRoster, getRoster, listRosters, queryRoster, registerRoster } from './roster.ts';

const T1 = { tenantId: 't-1' };
const T2 = { tenantId: 't-2' };

describe('roster 基础存取（U5 租户作用域）', () => {
  test('注册/覆盖/删除（租户共享）', () => {
    registerRoster({ name: 't_list', description: '测试名单', items: ['a', 'b'] }, T1);
    expect(getRoster('t_list', T1)).toEqual({ name: 't_list', description: '测试名单', items: ['a', 'b'] });

    registerRoster({ name: 't_list', items: ['c'] }, T1);
    expect(getRoster('t_list', T1)?.items).toEqual(['c']);

    expect(deleteRoster('t_list', T1)).toBe(true);
  });

  test('listRosters 支持名称大小写不敏感过滤（限本租户）', () => {
    registerRoster({ name: 'Alpha_List', items: [] }, T1);
    registerRoster({ name: 'beta-list', items: [] }, T1);
    const names = listRosters('ALPHA', T1).map((roster) => roster.name);
    expect(names).toEqual(['Alpha_List']);
    expect(listRosters(undefined, T1).length).toBeGreaterThanOrEqual(2);
    deleteRoster('Alpha_List', T1);
    deleteRoster('beta-list', T1);
  });

  test('queryRoster 返回命中结果，缺失名单返回 hit=false', () => {
    registerRoster({ name: 't_query', items: ['1.2.3.4'] }, T1);
    expect(queryRoster('t_query', '1.2.3.4', T1)).toEqual({ hit: true, roster: 't_query', value: '1.2.3.4' });
    expect(queryRoster('t_query', '5.6.7.8', T1).hit).toBe(false);
    expect(queryRoster('missing_list', 'x', T1).hit).toBe(false);
    deleteRoster('t_query', T1);
  });

  test('缺 tenantId 的 scope 直接抛错（fail closed）', () => {
    expect(() => registerRoster({ name: 'x', items: [] }, { tenantId: '' })).toThrow(/tenantId is required/);
    expect(() => getRoster('x', { tenantId: '' })).toThrow(/tenantId is required/);
  });
});

describe('roster 租户隔离与可见性（U5）', () => {
  test('自有 > 租户共享 > 不可见他人；跨租户永不可见', () => {
    registerRoster({ name: 'o_private_a', items: ['x'] }, { tenantId: 't-1', actor: 'user-a' });
    registerRoster({ name: 'o_private_b', items: ['y'] }, { tenantId: 't-1', actor: 'user-b' });
    registerRoster({ name: 'o_shared', items: ['z'] }, { tenantId: 't-1' });
    registerRoster({ name: 'o_other_tenant', items: ['w'] }, { tenantId: 't-2' });

    // 自有
    expect(getRoster('o_private_a', { tenantId: 't-1', actor: 'user-a' })?.items).toEqual(['x']);
    // 他人私有不可见
    expect(getRoster('o_private_a', { tenantId: 't-1', actor: 'user-b' })).toBeUndefined();
    // 租户共享可见
    expect(getRoster('o_shared', { tenantId: 't-1', actor: 'user-b' })).toBeDefined();
    // 管理员遍历本租户全域
    expect(getRoster('o_private_a', T1)).toBeDefined();
    // 跨租户永不可见
    expect(getRoster('o_private_a', T2)).toBeUndefined();
    expect(getRoster('o_other_tenant', T1)).toBeUndefined();

    const visibleB = listRosters(undefined, { tenantId: 't-1', actor: 'user-b' }).map((l) => l.name);
    expect(visibleB).toContain('o_private_b');
    expect(visibleB).toContain('o_shared');
    expect(visibleB).not.toContain('o_private_a');

    deleteRoster('o_private_a', { tenantId: 't-1', actor: 'user-a' });
    deleteRoster('o_private_b', { tenantId: 't-1', actor: 'user-b' });
    deleteRoster('o_shared', T1);
    deleteRoster('o_other_tenant', T2);
  });

  test('同名遮蔽：自有遮蔽租户共享，删除自有后回落共享', () => {
    registerRoster({ name: 'o_shadow', items: ['shared-item'] }, { tenantId: 't-1' });
    registerRoster({ name: 'o_shadow', items: ['own-item'] }, { tenantId: 't-1', actor: 'user-a' });

    expect(getRoster('o_shadow', { tenantId: 't-1', actor: 'user-a' })?.items).toEqual(['own-item']);
    expect(getRoster('o_shadow', { tenantId: 't-1', actor: 'user-b' })?.items).toEqual(['shared-item']);

    deleteRoster('o_shadow', { tenantId: 't-1', actor: 'user-a' });
    expect(getRoster('o_shadow', { tenantId: 't-1', actor: 'user-a' })?.items).toEqual(['shared-item']);
    deleteRoster('o_shadow', T1);
  });

  test('deleteRoster 权限矩阵：私有仅 owner/本租户管理员, 共享本租户任意 actor', () => {
    registerRoster({ name: 'o_perm_priv', items: [] }, { tenantId: 't-1', actor: 'u1' });
    registerRoster({ name: 'o_perm_shared', items: [] }, { tenantId: 't-1' });

    expect(deleteRoster('o_perm_priv', { tenantId: 't-1', actor: 'u2' })).toBe(false);
    expect(deleteRoster('o_perm_priv', { tenantId: 't-1', actor: 'u1' })).toBe(true);
    expect(deleteRoster('o_perm_shared', { tenantId: 't-1', actor: 'anyone' })).toBe(true);

    registerRoster({ name: 'o_perm_priv', items: [] }, { tenantId: 't-1', actor: 'u9' });
    expect(deleteRoster('o_perm_priv', T1)).toBe(true); // 管理员删私有
  });
});
