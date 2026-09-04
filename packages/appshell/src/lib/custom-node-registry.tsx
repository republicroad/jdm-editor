import { type CustomNodeSpecification, createJdmNode } from '@republicroad/jdm-editor';

import css from '../components/custom-node/custom-node.module.css';
import CodeIcon from '../components/icons/code';
import FlashCircleIcon from '../components/icons/flash-circle';
import { type CustomNodePlan, legacyUdfPlan, schemaToNodePlans } from './custom-node-plans';
import type { CustomNodeNamespace } from './custom-node-types';

export type CustomNodeSpec = CustomNodeSpecification<object, any>;

type SpecExtras = Pick<CustomNodeSpec, 'renderTab' | 'calculateDiff' | 'inferTypes'>;

type CreateSpecNodeOptions = Parameters<typeof createJdmNode>[0] & SpecExtras;

/** createJdmNode 只收 BaseNode 画布字段；spec 级 renderTab/calculateDiff/inferTypes 由本组合器附加 */
export const createSpecNode = (options: CreateSpecNodeOptions): CustomNodeSpec => {
  const { renderTab, calculateDiff, inferTypes, ...base } = options;
  return {
    ...createJdmNode(base),
    ...(renderTab ? { renderTab } : {}),
    ...(calculateDiff ? { calculateDiff } : {}),
    ...(inferTypes ? { inferTypes } : {}),
  };
};

const nodeIcon = (icon: React.ReactNode) => (
  <span className={css.nodeIcon} aria-hidden='true'>
    {icon}
  </span>
);

const kindIcons: Record<string, React.ReactNode> = {
  inout: nodeIcon(<FlashCircleIcon />),
};

const defaultIcon = nodeIcon(<CodeIcon />);

export { CUSTOM_FUNCTION_GROUP, LEGACY_UDF_KIND, uid } from './custom-node-plans';

export { parseOperatorArgs } from './http-request-protocol';

const planToJdmNode = (plan: CustomNodePlan): ReturnType<typeof createJdmNode> =>
  createJdmNode({
    kind: plan.kind,
    displayName: plan.displayName,
    group: plan.group,
    shortDescription: plan.shortDescription,
    icon: kindIcons[plan.kind] ?? defaultIcon,
    generateNode: plan.seed,
  });

/** 每个命名空间生成一个集合容器节点(kind = 命名空间名) */
export function schemaToCustomNodes(schema: CustomNodeNamespace[]): ReturnType<typeof createJdmNode>[] {
  return schemaToNodePlans(schema).map((plan) => planToJdmNode(plan));
}

export function createLegacyUdfNode(): ReturnType<typeof createJdmNode> {
  return planToJdmNode(legacyUdfPlan());
}

// 自定义节点 schema 来源(轻量实现见 custom-node-schema-source.ts；此处转出保持既有导入路径兼容)
export {
  DEFAULT_SCHEMA_URL,
  fetchCustomNodeSchema,
  parseCustomNodeSchemaPayload,
  type CustomNodeSchemaSource,
} from './custom-node-schema-source';
