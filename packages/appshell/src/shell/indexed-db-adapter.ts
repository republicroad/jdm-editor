import type { GraphPersistenceAdapter, GraphRecord } from './persistence';

/**
 * 本地图多版本持久化适配器（IndexedDB）。
 *
 * 为无后端的宿主提供与 HTTP 适配器同构的版本能力：
 * head + 版本归档 + auto/manual 标记 + 保留策略（全部 manual + 最近 AUTO_VERSIONS_KEEP 条 auto）。
 *
 * 语义差异（本地单用户）：无 owner 隔离、无 CONFLICT——save 恒成功，baseRevision 忽略。
 *
 * 存储模型：object store "graphs"，双键——
 *   head::{id}              → { meta, content }
 *   ver::{id}::{revision}   → { meta, content }（归档）
 */

export const AUTO_VERSIONS_KEEP = 20;

const DB_NAME = 'jdm-appshell-graphs';
const DB_VERSION = 1;
const STORE = 'graphs';
const HEAD_PREFIX = 'head::';
const VER_PREFIX = 'ver::';

type StoredMeta = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  extensions?: Record<string, unknown>;
  revision: string;
  auto?: boolean;
  createdAt: string;
  updatedAt: string;
};

type StoredEntry = { meta: StoredMeta; content: unknown };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result: T | undefined;
    const request = fn(store);
    if (request) request.onsuccess = () => (result = request.result);
    tx.oncomplete = () => {
      db.close();
      resolve(result as T);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

const headKey = (id: string): string => `${HEAD_PREFIX}${id}`;
const versionKey = (id: string, revision: string): string => `${VER_PREFIX}${id}::${revision}`;

async function getEntry(key: string): Promise<StoredEntry | null> {
  return withStore<StoredEntry | null>('readonly', (s) => s.get(key));
}

async function putEntry(key: string, entry: StoredEntry): Promise<void> {
  await withStore('readwrite', (s) => s.put(entry, key));
}

async function deleteKey(key: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(key));
}

/** 前缀匹配的键值列表（getAllKeys 与逐条 get 同序，spec 保证） */
async function listByPrefix(prefix: string): Promise<Array<{ key: string; entry: StoredEntry }>> {
  const keys = await withStore<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  const out: Array<{ key: string; entry: StoredEntry }> = [];
  for (const key of keys) {
    if (typeof key !== 'string' || !key.startsWith(prefix)) continue;
    const entry = await withStore<StoredEntry | null>('readonly', (s) => s.get(key));
    if (entry) out.push({ key, entry });
  }
  return out;
}

const bump = (revision: string): string => `v${Number(revision.slice(1)) + 1}`;

/** 保留策略：全部 manual 保留 + 最近 AUTO_VERSIONS_KEEP 条 auto，超限删最旧 */
async function pruneAutoVersions(id: string): Promise<void> {
  const archives = await listByPrefix(`${VER_PREFIX}${id}::`);
  const autos = archives
    .filter((a) => a.entry.meta.auto)
    .sort((a, b) => Number(a.entry.meta.revision.slice(1)) - Number(b.entry.meta.revision.slice(1)));
  const excess = autos.length - AUTO_VERSIONS_KEEP;
  for (let i = 0; i < excess; i++) {
    await deleteKey(autos[i].key);
  }
}

/** 本地图多版本持久化适配器（IndexedDB）——无后端宿主的完整版本能力 */
export function createIndexedDbAdapter(): GraphPersistenceAdapter {
  return {
    async list() {
      const heads = await listByPrefix(HEAD_PREFIX);
      return heads
        .map(({ entry }) => ({
          id: entry.meta.id,
          name: entry.meta.name,
          description: entry.meta.description,
          tags: entry.meta.tags,
          extensions: entry.meta.extensions,
          revision: entry.meta.revision,
          auto: entry.meta.auto,
          createdAt: entry.meta.createdAt,
          updatedAt: entry.meta.updatedAt,
        }))
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    },

    async load(id, opts) {
      const key = opts?.revision ? versionKey(id, opts.revision) : headKey(id);
      const entry = await getEntry(key);
      if (!entry) return null;
      const { meta, content } = entry;
      return {
        id: meta.id,
        name: meta.name,
        description: meta.description,
        tags: meta.tags,
        extensions: meta.extensions,
        revision: meta.revision,
        auto: meta.auto,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        content,
      };
    },

    async save(record) {
      const now = new Date().toISOString();
      const key = headKey(record.id);
      const old = await getEntry(key);
      const createdAt = old?.meta.createdAt ?? now;
      const revision = old?.meta.revision ? bump(old.meta.revision) : 'v1';

      // 归档旧 head（先归档后覆盖，防丢版本）——与 graphs-store 语义一致
      if (old) {
        await putEntry(versionKey(record.id, old.meta.revision), old);
      }

      const meta: StoredMeta = {
        id: record.id,
        name: record.name,
        description: record.description,
        tags: record.tags,
        extensions: record.extensions,
        revision,
        auto: record.auto,
        createdAt,
        updatedAt: now,
      };
      await putEntry(key, { meta, content: record.content });

      // auto 版本保留策略
      const autos = (await listByPrefix(`${VER_PREFIX}${record.id}::`)).filter((a) => a.entry.meta.auto);
      const excess = autos.length - AUTO_VERSIONS_KEEP;
      const sorted = autos
        .sort((a, b) => Number(a.entry.meta.revision.slice(1)) - Number(b.entry.meta.revision.slice(1)));
      for (let i = 0; i < excess; i++) {
        await deleteKey(sorted[i].key);
      }

      return { id: record.id, revision };
    },

    async delete(id) {
      if (!(await getEntry(headKey(id)))) return false;
      await deleteKey(headKey(id));
      for (const { key } of await listByPrefix(`${VER_PREFIX}${id}::`)) {
        await deleteKey(key);
      }
      return true;
    },

    async listVersions(id) {
      const archives = await listByPrefix(`${VER_PREFIX}${id}::`);
      return archives
        .map(({ entry }) => ({
          revision: entry.meta.revision,
          updatedAt: entry.meta.updatedAt,
          auto: entry.meta.auto,
        }))
        .sort((a, b) => a.revision.localeCompare(b.revision));
    },
  };
}
