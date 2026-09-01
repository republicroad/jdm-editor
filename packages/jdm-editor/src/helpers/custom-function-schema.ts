import { smartSplit } from './utility';

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

  return { mode: 'free', functions: allFunctions };
};

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
