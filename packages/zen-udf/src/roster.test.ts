import { describe, expect, test } from 'vitest';

import { deleteRoster, getRoster, listRosters, queryRoster, registerRoster } from './roster.ts';

describe('lists storage', () => {
  test('register + get 往返，重复注册覆盖旧值', () => {
    registerRoster({ name: 't_list', description: '测试名单', items: ['a', 'b'] });
    expect(getRoster('t_list')).toEqual({ name: 't_list', description: '测试名单', items: ['a', 'b'] });

    registerRoster({ name: 't_list', items: ['c'] });
    expect(getRoster('t_list')?.items).toEqual(['c']);

    deleteRoster('t_list');
  });

  test('listRosters 支持名称大小写不敏感过滤', () => {
    registerRoster({ name: 'Alpha_List', items: [] });
    registerRoster({ name: 'beta-list', items: [] });
    const names = listRosters('ALPHA').map((roster) => roster.name);
    expect(names).toEqual(['Alpha_List']);
    expect(listRosters().length).toBeGreaterThanOrEqual(2);
    deleteRoster('Alpha_List');
    deleteRoster('beta-list');
  });

  test('queryRoster 返回命中结果，缺失名单返回 hit=false', () => {
    registerRoster({ name: 't_query', items: ['1.2.3.4'] });
    expect(queryRoster('t_query', '1.2.3.4')).toEqual({ hit: true, roster: 't_query', value: '1.2.3.4' });
    expect(queryRoster('t_query', '5.6.7.8').hit).toBe(false);
    expect(queryRoster('missing_list', 'x').hit).toBe(false);
    deleteRoster('t_query');
  });

  test('deleteRoster 返回是否存在，删除后不可查', () => {
    registerRoster({ name: 't_del', items: [] });
    expect(deleteRoster('t_del')).toBe(true);
    expect(deleteRoster('t_del')).toBe(false);
    expect(getRoster('t_del')).toBeUndefined();
  });
});

describe('lists owner scoping', () => {
  test('私有名单仅 owner 可见，共享名单所有人可见', () => {
    registerRoster({ name: 'o_private_a', items: ['x'] }, 'user-a');
    registerRoster({ name: 'o_private_b', items: ['y'] }, 'user-b');
    registerRoster({ name: 'o_shared', items: ['z'] });

    expect(getRoster('o_private_a', 'user-a')?.items).toEqual(['x']);
    expect(getRoster('o_private_a', 'user-b')).toBeUndefined();
    expect(getRoster('o_shared', 'user-b')).toBeDefined();
    // 无 actor = 管理员视角全可见
    expect(getRoster('o_private_a')).toBeDefined();

    const visibleB = listRosters(undefined, 'user-b').map((l) => l.name);
    expect(visibleB).toContain('o_private_b');
    expect(visibleB).toContain('o_shared');
    expect(visibleB).not.toContain('o_private_a');

    deleteRoster('o_private_a', undefined);
    deleteRoster('o_private_b', undefined);
    deleteRoster('o_shared');
  });

  test('同名时自有遮蔽共享，且两份名单互不覆盖', () => {
    registerRoster({ name: 'o_shadow', items: ['shared-item'] });
    registerRoster({ name: 'o_shadow', items: ['own-item'] }, 'user-a');

    expect(getRoster('o_shadow', 'user-a')?.items).toEqual(['own-item']);
    expect(getRoster('o_shadow', 'user-b')?.items).toEqual(['shared-item']);
    // 删自有后回落到共享
    deleteRoster('o_shadow', 'user-a');
    expect(getRoster('o_shadow', 'user-a')?.items).toEqual(['shared-item']);
    deleteRoster('o_shadow');
  });

  test('deleteRoster 权限矩阵：私有仅 owner/管理员, 共享任意 actor', () => {
    registerRoster({ name: 'o_perm_priv', items: [] }, 'u1');
    registerRoster({ name: 'o_perm_shared', items: [] });

    expect(deleteRoster('o_perm_priv', 'u2')).toBe(false);
    expect(deleteRoster('o_perm_priv', 'u1')).toBe(true);
    expect(deleteRoster('o_perm_shared', 'anyone')).toBe(true);
    registerRoster({ name: 'o_perm_priv', items: [] }, 'u9');
    expect(deleteRoster('o_perm_priv')).toBe(true);
  });

  test('registerRoster 兼容对象内 owner 字段与第二参数两种传法', () => {
    registerRoster({ name: 'o_field', items: [], owner: 'via-field' });
    expect(getRoster('o_field', 'via-field')).toBeDefined();
    expect(getRoster('o_field', 'other')).toBeUndefined();
    deleteRoster('o_field');

    registerRoster({ name: 'o_param', items: [] }, 'via-param');
    expect(getRoster('o_param', 'via-param')).toBeDefined();
    deleteRoster('o_param', 'via-param');
  });
});
