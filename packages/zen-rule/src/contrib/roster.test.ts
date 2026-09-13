import { describe, expect, test } from 'vitest';

import { runWithExecContext } from '../exec-context.ts';
import { udfManager } from '../register.ts';
import { deleteRoster, registerRoster } from '../roster.ts';
import './roster.ts';

describe('roster UDF', () => {
  test('并发双 ctx 下各自命中 actor 私有名单', async () => {
    registerRoster({ name: 'o_udf_a', items: ['ip-a'] }, 'udf-user-a');
    registerRoster({ name: 'o_udf_b', items: ['ip-b'] }, 'udf-user-b');

    const call = () =>
      udfManager.call('roster', udfManager.funcBindParams('roster', ['o_udf_a', 'ip-a'])) as Promise<{
        hit: boolean;
      }>;
    const [asA, asB] = await Promise.all([
      runWithExecContext({ userId: 'udf-user-a' }, call),
      runWithExecContext({ userId: 'udf-user-b' }, call),
    ]);
    expect(asA.hit).toBe(true);
    expect(asB.hit).toBe(false);

    deleteRoster('o_udf_a', undefined);
    deleteRoster('o_udf_b', undefined);
  });
});
