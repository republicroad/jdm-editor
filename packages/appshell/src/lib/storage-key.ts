const PREFIX = 'jdm:';

export const storageKey = (key: string): string => `${PREFIX}${key}`;

/** 读取命名空间键；新键缺失时回退读历史无前缀键(一次性兼容)，均缺失或存储不可用返回 null */
export const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(storageKey(key)) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** 写入命名空间键；存储不可用时静默忽略 */
export const writeStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(storageKey(key), value);
  } catch {
    // noop
  }
};
