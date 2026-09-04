import { describe, expect, test } from 'vitest';

// bun test 无 DOM 全局（原 preload 随 zrule 内核的 setupBunDom 移除）——本套件自备最小 Storage 桩
const store = new Map<string, string>();
const localStorageStub: Storage = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
  key: (index) => [...store.keys()][index] ?? null,
  removeItem: (key) => void store.delete(key),
  setItem: (key, value) => void store.set(key, String(value)),
};
globalThis.localStorage = localStorageStub;

const { storageKey, readStorage, writeStorage } = await import('../storage-key');

describe('storage-key', () => {
  test('键名加 jdm: 前缀', () => {
    expect(storageKey('themePreference')).toBe('jdm:themePreference');
  });

  test('写入落在命名空间键上，读取可命中', () => {
    localStorage.removeItem('jdm:sk-test');
    writeStorage('sk-test', 'v1');
    expect(localStorage.getItem('jdm:sk-test')).toBe('v1');
    expect(readStorage('sk-test')).toBe('v1');
    localStorage.removeItem('jdm:sk-test');
  });

  test('新键缺失时回退读取历史无前缀键', () => {
    localStorage.setItem('sk-legacy', 'old');
    expect(readStorage('sk-legacy')).toBe('old');
    localStorage.removeItem('sk-legacy');
  });

  test('两处均缺失返回 null', () => {
    expect(readStorage('sk-missing')).toBeNull();
  });
});
