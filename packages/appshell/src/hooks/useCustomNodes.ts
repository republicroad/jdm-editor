import type { CustomNodeSpecification } from '@republicroad/jdm-editor';
import { useEffect, useMemo, useState } from 'react';

import { cryptoNode } from '../components/custom-node/crypto-node';
import { currentDateNode } from '../components/custom-node/current-date-node';
import { httpRequestNode } from '../components/custom-node/http-request-node';
import { jsonPathNode } from '../components/custom-node/json-path-node';
import { queryListNode } from '../components/custom-node/query-list-node';
import { templateNode } from '../components/custom-node/template-node';
import { useTheme } from '../context/theme.provider';
import {
  type CustomNodeSchemaSource,
  createLegacyUdfNode,
  fetchCustomNodeSchema,
  schemaToCustomNodes,
} from '../lib/custom-node-registry';
import type { CustomNodeNamespace } from '../lib/custom-node-types';
import { applyNodeOverrides } from '../skin/apply';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 与 jdm-editor 内部 customNodes 类型约定一致
type CustomNodeSpec = CustomNodeSpecification<object, any>;

// 宿主以专用节点接管的函数名（函数名全局唯一）：从 schema 驱动结果中排除，避免侧边栏重复
const overriddenFunctions = new Set(['roster', 'crypto', 'http_request', 'json_path', 'template', 'current_date']);

const isOverridden = (toolName: string): boolean => overriddenFunctions.has(toolName);

const filterOverridden = (schema: CustomNodeNamespace[]): CustomNodeNamespace[] =>
  schema
    .map((namespace) => ({
      ...namespace,
      tools: (namespace.tools ?? []).filter((tool) => !isOverridden(tool.name)),
    }))
    .filter((namespace) => namespace.tools.length > 0);

export type UseCustomNodesOptions = {
  /** 自定义节点 schema 来源：默认同源 /api/custom-nodes/schema；可传自定义 URL 或加载函数(库复用) */
  schemaSource?: CustomNodeSchemaSource;
  /** 追加宿主自定义节点(置于内置业务节点之前、schema 驱动节点之前) */
  extraNodes?: CustomNodeSpec[];
};

const composeBaseNodes = (extraNodes?: CustomNodeSpec[]): CustomNodeSpec[] => [
  ...(extraNodes ?? []),
  queryListNode,
  httpRequestNode,
  cryptoNode,
  jsonPathNode,
  templateNode,
  currentDateNode,
  createLegacyUdfNode() as CustomNodeSpec,
];

export function useCustomNodes(options?: UseCustomNodesOptions): {
  customNodes: CustomNodeSpec[];
  schema: CustomNodeNamespace[] | null;
  ready: boolean;
} {
  const { schemaSource, extraNodes } = options ?? {};
  const [schema, setSchema] = useState<CustomNodeNamespace[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCustomNodeSchema(schemaSource).then((value) => {
      if (!cancelled) {
        setSchema(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [schemaSource]);

  const baseNodes = useMemo(() => composeBaseNodes(extraNodes), [extraNodes]);

  // 皮肤节点 UI 槽位劫持：activeSkin.nodeOverrides 按 kind 覆写 renderTab/renderNode；
  // 无 ThemeContextProvider 时 useTheme 兜底空对象，行为与未开皮肤一致
  const { activeSkin } = useTheme();
  const nodeOverrides = activeSkin?.nodeOverrides;

  const customNodes = useMemo<CustomNodeSpec[]>(
    () =>
      applyNodeOverrides(
        schema ? [...baseNodes, ...schemaToCustomNodes(filterOverridden(schema))] : baseNodes,
        nodeOverrides,
      ),
    [baseNodes, schema, nodeOverrides],
  );

  return { customNodes, schema, ready: schema !== null };
}
