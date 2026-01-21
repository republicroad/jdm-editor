/**
 * 字段解析工具
 * 用于将 JSON 数据解析为字段树结构，支持树形视图展示和自动补全
 */

/**
 * 字段信息
 */
export interface FieldInfo {
  /** 字段名 */
  name: string;
  /** 字段路径，如 'data.user.name' */
  path: string;
  /** 节点路径，如 '$nodes.NodeA.user.name' */
  nodePath: string;
  /** 字段类型 */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined';
  /** 字段值（用于预览） */
  value?: unknown;
  /** 嵌套字段 */
  children?: FieldInfo[];
  /** 数组元素示例（如果是数组类型） */
  arrayItemType?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'mixed';
}

/**
 * 字段解析选项
 */
export interface ParseFieldsOptions {
  /** 最大嵌套层级，默认 5 */
  maxDepth?: number;
  /** 是否包含值预览，默认 true */
  includeValues?: boolean;
  /** 路径前缀，用于 $nodes. 格式 */
  pathPrefix?: string;
}

/**
 * 获取值的类型
 */
export function getValueType(value: unknown): FieldInfo['type'] {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (Array.isArray(value)) {
    return 'array';
  }

  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return type;
  }
  if (type === 'object') {
    return 'object';
  }

  return 'undefined';
}

/**
 * 获取数组元素类型
 * 如果数组元素类型不一致，返回 'mixed'
 */
export function getArrayItemType(arr: unknown[]): FieldInfo['arrayItemType'] {
  if (arr.length === 0) {
    return 'mixed';
  }

  const firstType = getValueType(arr[0]);
  const allSameType = arr.every(item => getValueType(item) === firstType);

  // 如果所有元素类型一致且不是 undefined，返回该类型，否则返回 'mixed'
  if (allSameType && firstType !== 'undefined') {
    return firstType as FieldInfo['arrayItemType'];
  }

  return 'mixed';
}

/**
 * 处理特殊字符的字段名
 * 如果包含空格或特殊字符，返回 ['fieldName'] 格式
 */
export function escapeFieldName(fieldName: string): string {
  // 检查是否包含特殊字符（除了字母、数字、下划线、美元符号）
  const hasSpecialChars = /[^a-zA-Z0-9_$]/.test(fieldName);

  // 检查是否以数字开头
  const startsWithNumber = /^[0-9]/.test(fieldName);

  if (hasSpecialChars || startsWithNumber) {
    // 返回方括号格式，并转义内部的引号和反斜杠
    const escaped = fieldName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `['${escaped}']`;
  }

  return fieldName;
}

/**
 * 构建字段路径
 */
function buildPath(parentPath: string, fieldName: string): string {
  const escapedName = escapeFieldName(fieldName);

  if (!parentPath) {
    return escapedName.startsWith('[') ? `$${escapedName}` : escapedName;
  }

  if (escapedName.startsWith('[')) {
    return `${parentPath}${escapedName}`;
  }

  return `${parentPath}.${escapedName}`;
}

/**
 * 构建节点路径
 */
function buildNodePath(parentPath: string, fieldName: string): string {
  const escapedName = escapeFieldName(fieldName);

  if (!parentPath) {
    return escapedName.startsWith('[') ? `$${escapedName}` : escapedName;
  }

  if (escapedName.startsWith('[')) {
    return `${parentPath}${escapedName}`;
  }

  return `${parentPath}.${escapedName}`;
}

/**
 * 递归解析字段
 */
function parseFieldsRecursive(
  data: unknown,
  parentPath: string,
  parentNodePath: string,
  currentDepth: number,
  options: Required<ParseFieldsOptions>
): FieldInfo[] {
  // 检查深度限制
  if (currentDepth > options.maxDepth) {
    return [];
  }

  // 处理 null 或 undefined
  if (data == null) {
    return [];
  }

  const fields: FieldInfo[] = [];
  const type = getValueType(data);

  // 处理对象
  if (type === 'object') {
    const obj = data as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = buildPath(parentPath, key);
      const fieldNodePath = buildNodePath(parentNodePath, key);
      const valueType = getValueType(value);

      const fieldInfo: FieldInfo = {
        name: key,
        path: fieldPath,
        nodePath: fieldNodePath,
        type: valueType,
      };

      // 添加值预览
      if (options.includeValues) {
        fieldInfo.value = value;
      }

      // 递归解析嵌套对象
      if (valueType === 'object') {
        fieldInfo.children = parseFieldsRecursive(
          value,
          fieldPath,
          fieldNodePath,
          currentDepth + 1,
          options
        );
      }

      // 处理数组
      if (valueType === 'array') {
        const arr = value as unknown[];
        fieldInfo.arrayItemType = getArrayItemType(arr);

        // 如果数组包含对象，解析第一个对象的结构
        if (arr.length > 0 && getValueType(arr[0]) === 'object') {
          fieldInfo.children = parseFieldsRecursive(
            arr[0],
            `${fieldPath}[0]`,
            `${fieldNodePath}[0]`,
            currentDepth + 1,
            options
          );
        }
      }

      fields.push(fieldInfo);
    }
  }

  // 处理数组（作为顶层）
  if (type === 'array') {
    const arr = data as unknown[];
    const arrayItemType = getArrayItemType(arr);

    // 如果数组包含对象，解析第一个对象的结构
    if (arr.length > 0 && getValueType(arr[0]) === 'object') {
      return parseFieldsRecursive(
        arr[0],
        parentPath ? `${parentPath}[0]` : '[0]',
        parentNodePath ? `${parentNodePath}[0]` : '[0]',
        currentDepth,
        options
      );
    }
  }

  return fields;
}

/**
 * 解析 JSON 数据为字段树结构
 *
 * @param data - 要解析的数据
 * @param options - 解析选项
 * @returns 字段树结构
 *
 * @example
 * ```typescript
 * const data = {
 *   user: {
 *     name: 'John',
 *     age: 30
 *   }
 * };
 * const fields = parseFields(data, { pathPrefix: '$nodes.NodeA' });
 * // fields[0].nodePath => '$nodes.NodeA.user'
 * ```
 */
export function parseFields(
  data: unknown,
  options?: ParseFieldsOptions
): FieldInfo[] {
  const defaultOptions: Required<ParseFieldsOptions> = {
    maxDepth: options?.maxDepth ?? 5,
    includeValues: options?.includeValues ?? true,
    pathPrefix: options?.pathPrefix ?? '',
  };

  const fields = parseFieldsRecursive(
    data,
    '',
    defaultOptions.pathPrefix,
    0,
    defaultOptions
  );

  return fields;
}

/**
 * 扁平化字段树，用于自动补全
 *
 * @param fields - 字段树结构
 * @returns 扁平化的字段列表
 *
 * @example
 * ```typescript
 * const fields = parseFields({ user: { name: 'John' } });
 * const flat = flattenFields(fields);
 * // flat => [
 * //   { name: 'user', path: 'user', ... },
 * //   { name: 'name', path: 'user.name', ... }
 * // ]
 * ```
 */
export function flattenFields(fields: FieldInfo[]): FieldInfo[] {
  const result: FieldInfo[] = [];

  function traverse(fieldList: FieldInfo[]) {
    for (const field of fieldList) {
      // 添加当前字段（不包含 children，避免循环引用）
      const { children, ...fieldWithoutChildren } = field;
      result.push(fieldWithoutChildren);

      // 递归处理子字段
      if (children && children.length > 0) {
        traverse(children);
      }
    }
  }

  traverse(fields);
  return result;
}
