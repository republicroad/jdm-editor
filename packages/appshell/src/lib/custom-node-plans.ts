import type { CustomNodeConfig, CustomNodeNamespace } from './custom-node-types';

export const uid = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `expr-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const LEGACY_UDF_KIND = 'UDF';

export const CUSTOM_FUNCTION_GROUP = '自定义函数';

export const EMPTY_EXPRESSIONS_CONFIG: CustomNodeConfig = {
  inputField: null,
  outputPath: null,
  passThrough: true,
  expressions: [],
};

const firstLine = (text?: string): string | undefined => {
  const clean = text?.split('\n')[0]?.trim();
  return clean || undefined;
};

/** 纯数据节点计划：kind 约定与播种逻辑在此(可测)，React/jdm-editor 组装在 registry */
export type CustomNodePlan = {
  kind: string;
  displayName: string;
  group: string;
  shortDescription?: string;
  seed: (params: { index: number }) => { name: string; config: CustomNodeConfig };
};

export const containerPlan = (namespace: CustomNodeNamespace): CustomNodePlan => {
  const kind = namespace.name;
  const toolCount = (namespace.tools ?? []).length;
  return {
    kind,
    displayName: namespace.title || namespace.name,
    group: CUSTOM_FUNCTION_GROUP,
    shortDescription: firstLine(namespace.description) ?? `函数集合(${toolCount})`,
    seed: ({ index }) => ({
      name: `${kind}${index}`,
      config: EMPTY_EXPRESSIONS_CONFIG,
    }),
  };
};

export const legacyUdfPlan = (): CustomNodePlan => ({
  kind: LEGACY_UDF_KIND,
  displayName: '自定义函数(旧版)',
  group: CUSTOM_FUNCTION_GROUP,
  shortDescription: '旧版自由节点：可选全部自定义函数',
  seed: ({ index }) => ({
    name: `${LEGACY_UDF_KIND}${index}`,
    config: EMPTY_EXPRESSIONS_CONFIG,
  }),
});

/** schema → 节点计划：每个命名空间一个集合容器节点(kind = 命名空间名，函数限定集合内) */
export function schemaToNodePlans(schema: CustomNodeNamespace[]): CustomNodePlan[] {
  return schema.flatMap((namespace) => ((namespace.tools ?? []).length > 0 ? [containerPlan(namespace)] : []));
}
