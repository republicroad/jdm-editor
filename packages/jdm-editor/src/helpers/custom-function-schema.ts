import { smartSplit } from './utility';

/** 局部 record 守卫（与 request-schema/utils.isRecord 同义；helper 顶层不引子目录模块） */
const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const emptyCustomFunctionReturnSchema = {};

export const normalizeFunctionReturns = (returns?: any) => {
  if (!returns || typeof returns !== 'object' || Array.isArray(returns)) {
    return emptyCustomFunctionReturnSchema;
  }

  return returns;
};

export const normalizeFunctionDefinition = (func: any, namespace?: string) => ({
  ...func,
  namespace: func?.namespace ?? namespace,
  returns: normalizeFunctionReturns(func?.returns),
});

export const normalizeCustomFunctions = (customFunctions?: any): any[] => {
  if (!Array.isArray(customFunctions)) {
    return [];
  }

  return customFunctions.flatMap((item: any) => {
    if (Array.isArray(item?.tools)) {
      return item.tools.map((tool: any) => normalizeFunctionDefinition(tool, item?.name));
    }

    return item?.name ? [normalizeFunctionDefinition(item)] : [];
  });
};

export const getFunctionReturnSchema = (funcmeta?: any) => normalizeFunctionReturns(funcmeta?.returns);

export const isFunctionExpressionValue = (value: unknown): value is string | string[] =>
  Array.isArray(value) || (typeof value === 'string' && value.includes(';;'));

export const isFunctionExpression = (expression?: { type?: string; value?: unknown } | null) =>
  expression?.type === 'function' || isFunctionExpressionValue(expression?.value);

export const getFunctionNameFromValue = (value?: unknown): string | null => {
  if (Array.isArray(value)) {
    const functionName = value[0]?.trim();
    return functionName ? functionName : null;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const [functionName] = smartSplit(value);
  const trimmedFunctionName = functionName?.trim();

  return trimmedFunctionName ? trimmedFunctionName : null;
};

/**
 * 旧格式函数值 → 规范形 {$call, kwargs}（读时转换，存储不动）。
 * 旧格式 = `fn;;args...` 字符串（引号感知切分）/ 位置数组 / 裸函数名——
 * 不转换就读成 {$call:'', kwargs:{}}，任何写回都会把旧实例损毁成
 * 引擎报错对象（'named call requires a string "$call" key'）。
 * 位置实参按 funcDef 声明序映射为 kwargs 键；超声明序的落 argN 兜位。
 * 已是规范形（非空对象）返回 null（调用方直用原值）。
 */
export const legacyValueToNamedCall = (
  value: unknown,
  funcDef?: { parameters?: unknown } | null,
): { $call: string; kwargs: Record<string, unknown> } | null => {
  if (isRecord(value)) {
    return null;
  }

  const fnName = getFunctionNameFromValue(value);
  if (!fnName) {
    return null;
  }

  const args: unknown[] = Array.isArray(value)
    ? value.slice(1)
    : typeof value === 'string' && value.includes(';;')
      ? smartSplit(value).slice(1)
      : [];

  const properties =
    funcDef && isRecord(funcDef.parameters) && isRecord(funcDef.parameters.properties)
      ? funcDef.parameters.properties
      : {};
  const declaredOrder = Object.keys(properties);

  const kwargs: Record<string, unknown> = {};
  args.forEach((arg, index) => {
    kwargs[declaredOrder[index] ?? `arg${index + 1}`] = arg;
  });

  return { $call: fnName, kwargs };
};

export const findCustomFunctionDefinition = (customFunctions: any[], functionName?: string | null) => {
  if (!functionName) {
    return undefined;
  }

  return customFunctions.find((func: any) => func?.name === functionName);
};

export const LEGACY_CUSTOM_FUNCTION_KIND = 'UDF';

export type FunctionScopeMode = 'scoped' | 'legacy' | 'free';

export type FunctionScope = {
  mode: FunctionScopeMode;
  functions: any[];
  /**
   * 孤儿容器标记：kind 有容器语义（非空、非 UDF）但目录中无对应命名空间——
   * 命名空间被租户过滤/下线的旧图降级。mode 恒为 free（不白块），调用方据此
   * 挂降级提示（可见集放大是 UX 供给非安全围栏，授权在服务端 registry）。
   */
  orphanKind?: string;
};

/**
 * kind 约定（单 token）：'UDF' → legacy(自由全函数)；namespace 名(集合容器节点) → scoped；其余 → free(现状行为)。
 * schema 函数一律落在 ns 容器内，不存在独立的函数名 kind。
 */
export const resolveFunctionScope = (kind?: string | null, customFunctions?: any): FunctionScope => {
  const namespaces = Array.isArray(customFunctions) ? customFunctions.filter(Boolean) : [];
  const allFunctions = normalizeCustomFunctions(namespaces);

  if (!kind) {
    return { mode: 'free', functions: allFunctions };
  }

  if (kind === LEGACY_CUSTOM_FUNCTION_KIND) {
    return { mode: 'legacy', functions: allFunctions };
  }

  const namespaceContainer = namespaces.find((ns: any) => ns?.name === kind);
  if (namespaceContainer) {
    return { mode: 'scoped', functions: normalizeCustomFunctions([namespaceContainer]) };
  }

  return { mode: 'free', functions: allFunctions, orphanKind: kind };
};

/**
 * @deprecated 位置数组种子产出器（ADR-015 前形态）——规范形写路径下零消费方，
 * 保留仅为公开 API 兼容；新代码勿用（种子一律 `{$call, kwargs}` 具名形）。
 */
export const buildDefaultFunctionExpression = (funcDef: any) => {
  const properties = funcDef?.parameters?.properties ?? {};
  const argExprs: Record<string, string> = {};
  const args = Object.keys(properties).map((argName: string) => {
    argExprs[argName] = properties[argName]?.default ?? '';
    return argExprs[argName];
  });

  return {
    type: 'function' as const,
    value: [funcDef?.name ?? '', ...args],
    funcmeta: funcDef,
    arg_exprs: argExprs,
    returnSchema: getFunctionReturnSchema(funcDef),
  };
};

/**
 * 打开节点时治愈函数作用域漂移：scoped 档 value[0] 不在集合内时重置为首函数；legacy/free 不治愈。
 * 返回 null 表示无需治愈。
 */
export const healExpressionsForScope = (expressions: any, scope?: FunctionScope): any[] | null => {
  if (!scope || scope.mode !== 'scoped' || !Array.isArray(expressions)) {
    return null;
  }

  const [primaryFunction] = scope.functions;
  if (!primaryFunction?.name) {
    return null;
  }

  const allowed = scope.functions.map((func: any) => func?.name).filter(Boolean);

  let changed = false;
  const healed = expressions.map((expression: any) => {
    if (!isFunctionExpression(expression)) {
      return expression;
    }

    const functionName = getFunctionNameFromValue(expression.value);
    if (!functionName || allowed.includes(functionName)) {
      return expression;
    }

    changed = true;
    return { ...expression, ...buildDefaultFunctionExpression(primaryFunction) };
  });

  return changed ? healed : null;
};

/**
 * 函数参数级漂移（兜底 tab 漂移带，分屏范式 drift 模式的第二次复用）：
 * 行的函数调用 args vs 该函数现行 parameters.properties 声明——
 * 缺参（声明有、行未传）与未识别键（行有、声明无）。
 * 仅 scoped 档评估（free/legacy 无单一契约可对照）。
 */
export type FunctionArgsDriftEntry = {
  rowId: string;
  rowKey: string;
  functionName: string;
  /** 函数已声明但本行未传的参数（附声明默认值） */
  missing: Array<{ name: string; default?: unknown }>;
  /** 本行携带但函数未声明的具名键 */
  unrecognized: string[];
  /** ADR-015 #3 检查单 MUST：平面 kwargs 携带名为 kwargs 的 Record 键——0.14+ 双读按信封解释的歧义触发形态 */
  kwargsKeyCollision?: boolean;
  /** 检查单三类之三：实参字面量形态与声明类型不符（静态可判字面量，标识符/表达式不标记） */
  typeMismatch?: Array<{ name: string; declaredType: string; actual: string }>;
  /** ADR-015 D 表第四类：$.refs 不指向同节点任何实例输出键 */
  danglingRefs?: string[];
};

/**
 * 实参字面量形态静态判定（typeMismatch 用）：数字/布尔/引号字符串/对象起始
 * 可静态判型；标识符与表达式串返回 null（静态不可判，不参与 mismatch）。
 * 信封 {mode:'literal', value} 按 value 类型判；expression/reference 信封
 * 返回 null（运行期求值，静态不可判）。
 */
const literalTypeOf = (value: unknown): string | null => {
  if (isRecord(value)) {
    if (value.mode === 'literal') return typeof value.value === 'string' ? 'string' : typeof value.value;
    return null; // expression/reference 信封静态不可判
  }
  if (typeof value !== 'string') {
    return null;
  }

  const t = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return 'number';
  if (t === 'true' || t === 'false') return 'boolean';
  if (/^".*"$/.test(t) || /^'.*'$/.test(t)) return 'string';
  if (t.startsWith('{') || t.startsWith('[')) return 'object';
  return null;
};

/** 声明类型 ↔ 字面量形态匹配（integer 向 number 归一——ADR-015 第七型口径）。 */
const literalTypeMatches = (declaredType: string, actual: string): boolean => {
  if (declaredType === actual) return true;
  if (declaredType === 'integer' && actual === 'number') return true; // 数字面量对 integer 声明不判错
  if (declaredType === 'number' && actual === 'integer') return true;
  return false;
};

const getScopeFunction = (scope: FunctionScope | undefined, functionName: string | null) => {
  if (!scope || scope.mode !== 'scoped' || !functionName) {
    return undefined;
  }

  return scope.functions.find((func: any) => func?.name === functionName);
};

export const computeFunctionArgsDrift = (expressions: any, scope?: FunctionScope): FunctionArgsDriftEntry[] => {
  if (!scope || scope.mode !== 'scoped' || !Array.isArray(expressions)) {
    return [];
  }

  const entries: FunctionArgsDriftEntry[] = [];

  expressions.forEach((expression: any) => {
    // 规范形（ADR-015 §2）：value = {$call, kwargs}——直接按 kwargs 键对比
    if (isRecord(expression.value) && typeof expression.value.$call === 'string') {
      const funcDef = getScopeFunction(scope, expression.value.$call);
      if (!funcDef) {
        return;
      }

      const properties = isRecord(funcDef.parameters) ? (funcDef.parameters.properties ?? {}) : {};
      const declared = Object.keys(properties);
      const kwargs: Record<string, unknown> = isRecord(expression.value.kwargs) ? expression.value.kwargs : {};
      const missing = declared
        .filter((name) => !(name in kwargs))
        .map((name) => ({ name, default: properties[name]?.default }));
      const unrecognized = Object.keys(kwargs).filter((name) => !declared.includes(name) && name !== '$positional');

      // ADR-015 #3 检查单 MUST：函数声明了名为 kwargs 的参数时，对象型调用
      // kwargs 无法与信封区分（0.14+ 双读按信封解释）——歧义触发形态
      // （迁移 = 参数改名或 {$call, kwargs: { kwargs: {...} }} 显式信封）。
      // 判定与 zen-udf detectKwargsEnvelopeAmbiguity 对齐（上游规则 =
      // `'kwargs' in parameters.properties`；kernel 零依赖 → 内联同规则）。
      const kwargsKeyCollision = 'kwargs' in properties;

      // ADR-015 #3 检查单三类之三：typeMismatch——实参字面量形态与声明类型
      // 不符（仅静态可判字面量：数字/布尔/引号字符串/对象；标识符与表达式
      // 静态不可判不标记；信封 literal 按 value 类型判）。
      const typeMismatch: Array<{ name: string; declaredType: string; actual: string }> = [];
      declared.forEach((name) => {
        const declaredType = String((properties[name] as { type?: unknown } | undefined)?.type ?? '');
        const actual = literalTypeOf(kwargs[name]);
        if (actual === null || declaredType === '' || literalTypeMatches(declaredType, actual)) {
          return;
        }
        typeMismatch.push({ name, declaredType, actual });
      });

      // 悬空引用（ADR-015 D 表第四类）：$.refs 不指向同节点任何实例输出键
      // （复用 collectRefs 信封感知提取；悬空在运行期求值 null 不建边）。
      const refs = new Set<string>();
      collectRefs(expression.value, refs);
      const instanceKeys = new Set(expressions.map((e) => e?.key).filter(Boolean) as string[]);
      const danglingRefs = [...refs].filter((k) => !instanceKeys.has(k)).sort();

      if (
        missing.length > 0 ||
        unrecognized.length > 0 ||
        typeMismatch.length > 0 ||
        kwargsKeyCollision ||
        danglingRefs.length > 0
      ) {
        entries.push({
          rowId: expression.id,
          rowKey: expression.key ?? '',
          functionName: expression.value.$call,
          missing,
          unrecognized,
          kwargsKeyCollision,
          typeMismatch,
          danglingRefs,
        });
      }

      return;
    }

    if (!isFunctionExpression(expression)) {
      return;
    }

    const functionName = getFunctionNameFromValue(expression.value);
    if (!functionName) {
      return;
    }

    const funcDef = getScopeFunction(scope, functionName);
    if (!funcDef) {
      return;
    }

    const properties = isRecord(funcDef.parameters) ? (funcDef.parameters.properties ?? {}) : {};
    const declared = Object.keys(properties);
    const argExprs = isRecord(expression.arg_exprs) ? expression.arg_exprs : null;
    const positionalArgs = Array.isArray(expression.value) ? expression.value.slice(1) : [];

    if (argExprs) {
      const namedKeys = Object.keys(argExprs);
      const missing = declared
        .filter((name) => !namedKeys.includes(name))
        .map((name) => ({ name, default: properties[name]?.default }));
      const unrecognized = namedKeys.filter((name) => !declared.includes(name));

      if (missing.length > 0 || unrecognized.length > 0) {
        entries.push({
          rowId: expression.id,
          rowKey: expression.key ?? '',
          functionName,
          missing,
          unrecognized,
        });
      }

      return;
    }

    // 纯位置形态（无具名镜像）：按声明数对比位数，缺尾报缺（不识别中插——位置绑定的固有盲区，迁移链负责）
    const missingCount = Math.max(declared.length - positionalArgs.length, 0);
    if (missingCount > 0) {
      entries.push({
        rowId: expression.id,
        rowKey: expression.key ?? '',
        functionName,
        missing: declared
          .slice(declared.length - missingCount)
          .map((name) => ({ name, default: properties[name]?.default })),
        unrecognized: [],
      });
    }
  });

  return entries;
};

/**
 * $-路径形态实参检测（ADR-016 OQ7 随档动作②，jdm dollar-scope-decision 裁定）：
 * kwargs 值为 `$.` 开头形态（裸字符串 / expression·reference 信封内路径）时，
 * 引擎 kwargs 求值域不接通 dollar 作用域——恒 null（jdm 立法语义非回归）。
 * 检测范围不含 literal 信封（原样绑定是 ADR-016 的歧义根治语义，`$.x`
 * 作字面量合法）。迁移 = 剥 `$.` 前缀为裸路径（migrateDollarFormArgs）。
 */
export type DollarFormEntry = {
  rowId: string;
  rowKey: string;
  /** $-路径形态的参数名清单 */
  params: string[];
};

const isDollarFormValue = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.trim().startsWith('$.');
  }
  if (isRecord(value) && typeof value.value === 'string') {
    return (value.mode === 'expression' || value.mode === 'reference') && value.value.trim().startsWith('$.');
  }
  return false;
};

export const findDollarFormRows = (expressions: any): DollarFormEntry[] => {
  if (!Array.isArray(expressions)) {
    return [];
  }

  const rows: DollarFormEntry[] = [];
  for (const expression of expressions) {
    if (!isRecord(expression) || !isRecord(expression.value) || expression.value.$call === undefined) {
      continue;
    }

    const kwargs = isRecord(expression.value.kwargs) ? expression.value.kwargs : {};
    const params = Object.entries(kwargs)
      .filter(([, v]) => isDollarFormValue(v))
      .map(([name]) => name);
    if (params.length > 0) {
      rows.push({ rowId: String(expression.id ?? ''), rowKey: String(expression.key ?? ''), params });
    }
  }

  return rows;
};

/** 一键迁移：$-路径形态剥 `$.` 前缀为裸路径（裸值与信封 value 同规则）；无可迁移返回 null */
export const migrateDollarFormArgs = (expressions: any, rows?: DollarFormEntry[]): any[] | null => {
  const targets = new Set((rows ?? findDollarFormRows(expressions)).map((row) => row.rowId));
  if (targets.size === 0) {
    return null;
  }

  const stripDollar = (value: unknown): unknown => {
    if (typeof value === 'string' && value.trim().startsWith('$.')) {
      return value.replace(/^\$\./, '');
    }
    if (
      isRecord(value) &&
      typeof value.value === 'string' &&
      (value.mode === 'expression' || value.mode === 'reference') &&
      value.value.trim().startsWith('$.')
    ) {
      return { ...value, value: String(value.value).replace(/^\$\./, '') };
    }
    return value;
  };

  let changed = false;
  const migrated = (expressions as any[]).map((expression: any) => {
    if (!isRecord(expression) || !targets.has(String(expression?.id ?? ''))) {
      return expression;
    }
    const value = expression?.value;
    if (!isRecord(value) || !isRecord(value.kwargs)) {
      return expression;
    }
    changed = true;
    return {
      ...expression,
      value: {
        ...value,
        kwargs: Object.fromEntries(Object.entries(value.kwargs).map(([k, v]) => [k, stripDollar(v)])),
      },
    };
  });

  return changed ? migrated : null;
};

/**
 * 缺参修复（只增不删——圆往返保真）：按声明序重建规范形
 * value = [funcName, ...声明序参数] + arg_exprs 全量镜像；
 * 既有值保留（具名优先、位置次之、默认兜底），未识别键不动。
 * 无可修内容返回 null。
 */
export const fillMissingFunctionArgs = (
  expressions: any,
  drift: FunctionArgsDriftEntry[] | undefined,
  scope?: FunctionScope,
): any[] | null => {
  if (!scope || scope.mode !== 'scoped' || !Array.isArray(expressions) || !Array.isArray(drift) || drift.length === 0) {
    return null;
  }

  const driftByRow = new Map(drift.filter((entry) => entry.missing.length > 0).map((entry) => [entry.rowId, entry]));

  if (driftByRow.size === 0) {
    return null;
  }

  let changed = false;
  const healed = expressions.map((expression: any) => {
    const entry = driftByRow.get(expression?.id);
    if (!entry) {
      return expression;
    }

    const funcDef = getScopeFunction(scope, entry.functionName);
    const properties = funcDef && isRecord(funcDef.parameters) ? (funcDef.parameters.properties ?? {}) : {};
    const declared = funcDef ? Object.keys(properties) : [];
    if (declared.length === 0) {
      return expression;
    }

    const argExprs = isRecord(expression.arg_exprs) ? { ...expression.arg_exprs } : {};
    const positionalArgs = Array.isArray(expression.value) ? expression.value.slice(1) : [];

    declared.forEach((name, index) => {
      if (name in argExprs) {
        return;
      }

      const positional = positionalArgs[index];
      argExprs[name] = positional !== undefined ? positional : (properties[name]?.default ?? '');
      changed = true;
    });

    changed =
      changed ||
      declared.some((name) => !Object.keys(isRecord(expression.arg_exprs) ? expression.arg_exprs : {}).includes(name));

    return {
      ...expression,
      arg_exprs: argExprs,
      value: [entry.functionName, ...declared.map((name) => argExprs[name] ?? '')],
    };
  });

  return changed ? healed : null;
};

/**
 * ADR-015 调用规范（CONTRACT §11 canonical）：`{$call, kwargs}` 具名字典。
 * 双向转换纯助手——存储为规范形，编辑器（CustomFunctionTable）继续以
 * 位置数组形态编辑（价值：表达式构造器按位求值），转换在读写两缘发生。
 */

/** 规范调用形（CONTRACT §11）：{$call: 函数名, kwargs: 具名参数} */
export type NamedFunctionCall = {
  $call: string;
  kwargs: Record<string, unknown>;
};

/** 声明序参数键（funcDef.parameters.properties 的键序即位置序） */
const declaredArgNames = (funcDef?: { parameters?: unknown }): string[] =>
  funcDef && isRecord(funcDef.parameters) && isRecord(funcDef.parameters.properties)
    ? Object.keys(funcDef.parameters.properties)
    : [];

/**
 * 编辑器位置数组 → 规范字典：位置位按声明序映射为参数键；
 * 超出声明位的溢出值收进保留键 `$positional`（0.14 同款约定，供漂移带按
 * extra 检出）；priorKwargs 中的非位置键原样并回（圆往返保真）。
 */
export const editorValueToNamedCall = (
  value: unknown,
  funcDef?: { parameters?: unknown },
  priorKwargs?: Record<string, unknown> | null,
): NamedFunctionCall | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const declared = declaredArgNames(funcDef);
  const fn = String(value[0] ?? '').trim();
  if (!fn) {
    return null;
  }

  const kwargs: Record<string, unknown> = { ...(priorKwargs ?? {}) };
  declared.forEach((name, index) => {
    if (value[index + 1] !== undefined) {
      kwargs[name] = value[index + 1];
    }
  });
  const overflow = value.slice(declared.length + 1);
  if (overflow.length > 0) {
    kwargs.$positional = overflow;
  } else {
    delete kwargs.$positional;
  }

  return { $call: fn, kwargs };
};

/**
 * 规范字典 → 编辑器位置数组（声明序取 kwargs，`$positional` 溢出按原序追加；
 * kwargs 中编辑器无法表达的额外键不进数组——由写路径从 priorKwargs 并回）。
 * 不可转换返回 null（该行走只读/原样保真）。
 */
export const namedCallToEditorValue = (call: unknown, funcDef?: { parameters?: unknown }): string[] | null => {
  if (!isRecord(call)) {
    return null;
  }

  const fn = typeof call.$call === 'string' ? call.$call.trim() : '';
  if (!fn) {
    return null;
  }

  const kwargs = isRecord(call.kwargs) ? call.kwargs : {};
  const declared = declaredArgNames(funcDef);
  const positional = declared.map((name) => (kwargs[name] !== undefined ? kwargs[name] : ''));
  const overflow = Array.isArray(kwargs.$positional) ? kwargs.$positional : [];

  return [fn, ...positional, ...overflow];
};

/**
 * ADR-015 增补（P1 骨架）：多实例视图模型——主从式（Master-Detail）的纯函数层。
 * 并行执行语义（Promise.all 逐条隔离）下实例集合无序：展示按字典序（集合观，
 * 不暗示执行序）；依赖声明（dependsOn）由实例详情面板提供编辑入口（增删 +
 * 引用源面板），静态漂移见 computeInstanceDependencyDrift。
 */

/** 实例视图模型（主从列表项） */
export type FunctionInstanceView = {
  id: string;
  /** 函数调用名（规范形 $call；未解析行 = null，列表显示占位） */
  fn: string | null;
  /** 输出绑定键（并行结果归集标签；重复 = error 级） */
  key: string;
  /** ADR-015 增补：显式依赖声明（实例详情面板提供编辑入口） */
  dependsOn?: string[];
  /** 同函数多实例序号（从 1 起；异函数实例为 1） */
  seq: number;
};

/** 实例级漂移三类计数（复用 computeFunctionArgsDrift 的行结果聚合） */
export type InstanceDriftSummary = {
  missing: number;
  unrecognized: number;
};

/** 展示序：函数名 → 输出键 字典序（集合观，不暗示执行序） */
export const compareInstances = (left: FunctionInstanceView, right: FunctionInstanceView): number => {
  const fn = (left.fn ?? '').localeCompare(right.fn ?? '');
  if (fn !== 0) {
    return fn;
  }

  return left.key.localeCompare(right.key);
};

/** 行数组 → 实例视图列表（展示序；同函数实例按出现序编 seq） */
export const buildInstanceViews = (expressions: any, _scope?: FunctionScope): FunctionInstanceView[] => {
  if (!Array.isArray(expressions)) {
    return [];
  }

  const seqByFn = new Map<string, number>();
  const views = expressions.map((expression: any) => {
    let fn: string | null = null;
    let kwargs: Record<string, unknown> | null = null;

    if (isRecord(expression?.value)) {
      fn = typeof expression.value.$call === 'string' ? expression.value.$call : null;
      kwargs = isRecord(expression.value.kwargs) ? expression.value.kwargs : null;
    } else if (isFunctionExpression(expression)) {
      fn = getFunctionNameFromValue(expression.value);
    }

    let seq = 1;
    if (fn) {
      seq = (seqByFn.get(fn) ?? 0) + 1;
      seqByFn.set(fn, seq);
    }

    const view: FunctionInstanceView = {
      id: String(expression?.id ?? ''),
      fn,
      key: String(expression?.key ?? ''),
      seq: fn ? seq : 1,
    };

    // dependsOn 透传（实例详情面板提供编辑入口，往返保真）
    if (isRecord(expression) && Array.isArray(expression.dependsOn)) {
      view.dependsOn = expression.dependsOn.map(String);
    }
    void kwargs;

    return view;
  });

  return views.sort(compareInstances);
};

/** 输出键重复检测（并行归集覆盖 + 变量重声明双风险，error 级） */
export const findDuplicateKeys = (expressions: any): string[] => {
  if (!Array.isArray(expressions)) {
    return [];
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();

  expressions.forEach((expression: any) => {
    const key = String(expression?.key ?? '').trim();
    if (!key) {
      return;
    }

    if (seen.has(key)) {
      duplicates.add(key);
    }

    seen.add(key);
  });

  return [...duplicates];
};

/** 实例级漂移汇总（rowId → 计数，供列表点标） */
export const summarizeInstanceDrift = (drift: FunctionArgsDriftEntry[]): Record<string, InstanceDriftSummary> => {
  const summary: Record<string, InstanceDriftSummary> = {};

  drift.forEach((entry) => {
    const current = summary[entry.rowId] ?? { missing: 0, unrecognized: 0 };
    summary[entry.rowId] = {
      missing: current.missing + entry.missing.length,
      unrecognized: current.unrecognized + entry.unrecognized.length,
    };
  });

  return summary;
};

/**
/**
 * 实例依赖调度（ADR-015 增补）：Kahn 分层（层内并行/层间串行）。
 * 依赖边 = 从 kwargs 值中提取 `$.key` 引用（具名 kwargs 的值为表达式串）
 * ∪ 显式 `dependsOn`，并集。悬空引用不建边（漂移带检出）。
 * 返回分层调度表或结构化错误。
 */
export type InstanceSchedule =
  | { ok: true; layers: string[][]; hasEdges: boolean; depsByItem: Record<string, string[]> }
  | { ok: false; error: 'DUPLICATE_OUTPUT' | 'CYCLE_DETECTED'; keys: string[] };

/** 从表达式串中提取 `$.key` 引用 */
const extractDollarRefs = (expr: string, into: Set<string>): void => {
  const pattern = /\$\.([A-Za-z_][A-Za-z0-9_.]*)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(expr)) !== null) into.add(m[1]!.split('.')[0]);
};

/** 递归收集值中所有 $. 引用（含信封解包与 kwargs 遍历） */
const collectRefs = (value: unknown, into: Set<string>): void => {
  if (typeof value === 'string') {
    extractDollarRefs(value, into);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, into);
    return;
  }
  if (isRecord(value)) {
    for (const v of Object.values(value)) collectRefs(v, into);
  }
};

export const computeInstanceSchedule = (expressions: any): InstanceSchedule => {
  if (!Array.isArray(expressions)) return { ok: true, layers: [], hasEdges: false, depsByItem: {} };

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const expr of expressions) {
    const key = String(expr?.key ?? '');
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  if (duplicates.size > 0) return { ok: false, error: 'DUPLICATE_OUTPUT', keys: [...duplicates] };

  const byKey = new Map<string, any>();
  for (const expr of expressions) {
    const key = String(expr?.key ?? '');
    if (!key) continue;
    byKey.set(key, expr);
  }

  const deps = new Map<string, Set<string>>();
  let hasEdges = false;
  for (const [key, item] of byKey) {
    const refs = new Set<string>();
    const value = item?.value;
    if (isRecord(value) && isRecord(value.kwargs)) {
      // 规范形 { $call, kwargs }：扫描 kwargs 值中的 $. 引用
      for (const v of Object.values(value.kwargs)) collectRefs(v, refs);
    } else {
      // 旧形态：整个 value 扫描 $. 引用
      collectRefs(value, refs);
    }
    for (const dep of (item?.dependsOn as string[] | undefined) ?? []) refs.add(dep);
    const edges = new Set([...refs].filter((ref) => byKey.has(ref)));
    deps.set(key, edges);
    if (edges.size > 0) hasEdges = true;
  }

  const layers: string[][] = [];
  const remaining = new Map(deps);
  const emitted = new Set<string>();
  while (remaining.size > 0) {
    const layer = [...remaining.entries()]
      .filter(([, edges]) => [...edges].every((dep) => emitted.has(dep)))
      .map(([key]) => key)
      .sort();
    if (layer.length === 0) return { ok: false, error: 'CYCLE_DETECTED', keys: [...remaining.keys()] };
    layers.push(layer);
    for (const key of layer) {
      emitted.add(key);
      remaining.delete(key);
    }
  }

  const depsByItem: Record<string, string[]> = {};
  for (const [key, edges] of deps) depsByItem[key] = [...edges];

  return { ok: true, layers, hasEdges, depsByItem };
};

/**
 * 实例依赖声明漂移（编辑器静态预检，ADR-015 增补 UI 面）：
 * - **danglingDependsOn**：声明的依赖键不存在——调度器静默过滤（`byKey.has` 滤网），
 *   args 漂移带的 danglingRefs 只查 `$.` 引用不查声明，此处是唯一检出位（error 级）；
 * - **declaredUnused**：声明的依赖在 args 中无 `$.` 引用——合法（纯排序用途），
 *   信息级提示，多为遗留/笔误。
 * 环/重复/分层由 computeInstanceSchedule 覆盖（编辑器已有 CYCL 警示带），此处不重复。
 */
export type InstanceDependencyDriftEntry = {
  instanceId: string;
  instanceKey: string;
  /** 涉及的依赖键 */
  dep: string;
};

export type InstanceDependencyDrift = {
  danglingDependsOn: InstanceDependencyDriftEntry[];
  declaredUnused: InstanceDependencyDriftEntry[];
};

export const computeInstanceDependencyDrift = (expressions: any): InstanceDependencyDrift => {
  const drift: InstanceDependencyDrift = { danglingDependsOn: [], declaredUnused: [] };
  if (!Array.isArray(expressions)) return drift;

  const keys = new Set<string>(expressions.map((expr: any) => String(expr?.key ?? '')).filter(Boolean));

  for (const expr of expressions) {
    const instanceKey = String(expr?.key ?? '');
    const instanceId = String(expr?.id ?? '');
    const dependsOn = (expr?.dependsOn as string[] | undefined) ?? [];
    if (dependsOn.length === 0) continue;

    // 该实例 args 中实际 `$.` 引用的首段键集合（与调度器同款提取）
    const refs = new Set<string>();
    const value = expr?.value;
    if (isRecord(value) && isRecord(value.kwargs)) {
      for (const v of Object.values(value.kwargs)) collectRefs(v, refs);
    } else {
      collectRefs(value, refs);
    }

    for (const dep of dependsOn) {
      const depKey = String(dep);
      if (!keys.has(depKey)) {
        drift.danglingDependsOn.push({ instanceId, instanceKey, dep: depKey });
      } else if (!refs.has(depKey)) {
        drift.declaredUnused.push({ instanceId, instanceKey, dep: depKey });
      }
    }
  }
  return drift;
};
