import { v4 } from "uuid";
const unsecuredCopyToClipboard = (text: string) => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Unable to copy to clipboard', err);
  }
  document.body.removeChild(textArea);
};

export const copyToClipboard = async (content: string) => {
  if (window.isSecureContext && navigator.clipboard) {
    await navigator.clipboard.writeText(content);
  } else {
    unsecuredCopyToClipboard(content);
  }
};

export const pasteFromClipboard = async (): Promise<string> => {
  try {
    return navigator.clipboard.readText();
  } catch {
    return '';
  }
};

export const get = <T>(obj: any, path: string, defaultValue: T): T => {
  return path.split('.').reduce((a, c) => (a && a[c] ? a[c] : defaultValue || null), obj) as T;
};

type InputCell = {
  id: string;
  key: string;
  type: string;
  value: boolean|number|string|string[];
};

export const fJson = (arr: InputCell[]) => {
  const inject = (str: string, obj: any, value: string | number | boolean) => {
    let tmp = obj;
    const keys = str.split('.');
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (i === keys.length - 1) {
        tmp[key] = value;
      } else if (!tmp[key]) {
        tmp[key] = {};
        tmp = tmp[key];
      } else {
        tmp = tmp[key];
      }
    }
  };

  const source = {};
  arr && arr.forEach((item:any) => {
    switch (item.type) {
      case 'bool':
        item.value !== undefined && inject(item.key, source, item.value === true);
        break;
      case 'number':
        (typeof item.value === 'string'|| typeof item.value === 'number') && inject(item.key, source, parseFloat(item.value));
        break;
      case 'array':
        // 支持数组类型，直接使用数组值
        if (Array.isArray(item.value)) {
          inject(item.key, source, item.value);
        }
        break;
      case 'object':
        // 支持对象类型，直接使用对象值
        if (typeof item.value === 'object' && item.value !== null && !Array.isArray(item.value)) {
          inject(item.key, source, item.value);
        }
        break;
      case 'function':
        // Array.isArray(item.value) && inject(item.key, source, `${item.key}(${item.value.join(',')})`);
        break;
      default:
        typeof item.value === 'string'&& inject(item.key, source, item.value);
    }
  });

  return JSON.stringify(source, null, 2);
}

type ParsedItem = {
  id: string;
  key: string;
  type: string;
  value: any;
  desc: string;
};

export const parseJsonToItems = (jsonObject: any): ParsedItem[] => {
  const result: ParsedItem[] = [];

  const traverse = (obj: any, prefix: string = '') => {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        const currentKey = prefix ? `${prefix}.${key}` : key;
        const id = v4(); // 生成唯一的 ID

        if (Array.isArray(value)) {
          result.push({
            id,
            key: currentKey,
            type: 'array',
            value,
            desc: ''
          });
        } else if (typeof value === 'object' && value !== null) {
          traverse(value, currentKey);
        }else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
          // 判断是否为日期时间格式字符串
          result.push({
            id,
            key: currentKey,
            type: 'datetime',
            value,
            desc: ''
          });
        } else {
          result.push({
            id,
            key: currentKey,
            type: typeof value,
            value,
            desc: ''
          });
        }
      }
    }
  };

  traverse(jsonObject);

  return result;
};

/**
 * 使用正则表达式分割字符串，避免在引号内的;;被分割
 * @param str 要分割的字符串
 * @returns 分割后的数组
 */
export const smartSplit = (str: string): string[] => {
  if (!str || typeof str !== 'string') {
    return [''];
  }
  
  // 使用正则表达式分割，避免在引号内的;;被分割
  const regex = /;;(?=(?:[^"'`]*["'`][^"'`]*["'`])*[^"'`]*$)/;
  return str.split(regex);
};