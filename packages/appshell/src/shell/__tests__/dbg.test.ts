import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { createIndexedDbAdapter } from '../indexed-db-adapter';

const adapter = createIndexedDbAdapter();

test('debug retention', async () => {
  const id = 'dbg2';
  await adapter.save({ id, name: 'seed', content: { n: 1 }, revision: '' });
  for (let i = 2; i <= 23; i++) {
    await adapter.save({ id, name: `a${i}`, content: { n: i }, auto: true, revision: '' });
  }
  const versions = await adapter.listVersions(id);
  console.log('[dbg] versions:', versions.map(v => `${v.revision}${v.auto ? '(A)' : ''}`).join(','));
  expect(true).toBe(true);
});