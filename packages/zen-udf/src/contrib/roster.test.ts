import { describe, expect, test } from 'vitest';

import { runWithExecContext } from '../exec-context.ts';
import { globalUdfRegistry } from '../register.ts';
import { deleteRoster, registerRoster } from '../roster.ts';
import './roster.ts';

describe('roster UDF', () => {
  test('并发双 ctx 下各自命中 actor 私有名单', async () => {
    registerRoster({ name: 'o_udf_a', items: ['ip-a'] }, { tenantId: 'roster-tenant', actor: 'udf-user-a' });
    registerRoster({ name: 'o_udf_b', items: ['ip-b'] }, { tenantId: 'roster-tenant', actor: 'udf-user-b' });

    const call = () =>
      globalUdfRegistry.call('roster', globalUdfRegistry.funcBindParams('roster', ['o_udf_a', 'ip-a'])) as Promise<{
        hit: boolean;
      }>;
    const [asA, asB] = await Promise.all([
      runWithExecContext({ tenantId: 'roster-tenant', userId: 'udf-user-a' }, call),
      runWithExecContext({ tenantId: 'roster-tenant', userId: 'udf-user-b' }, call),
    ]);
    expect(asA.hit).toBe(true);
    expect(asB.hit).toBe(false);

    deleteRoster('o_udf_a', { tenantId: 'roster-tenant', actor: 'udf-user-a' });
    deleteRoster('o_udf_b', { tenantId: 'roster-tenant', actor: 'udf-user-b' });
  });
});
