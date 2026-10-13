import json5 from 'json5';

import {
  buildRequestExampleTemplateFromDefinitions,
  collectExampleDataPaths,
  formatRequestExampleSourceName,
  getRequestExampleDataDefinitionConflicts,
  mergeRequestExampleDataWithTemplate,
  normalizeRequestExampleDataByDefinitions,
  updateRequestSchemaExamples,
} from './examples';
import { parseRequestSchemaValue, resolveRequestSchemaValue, setRequestSchemaValue } from './schema-value';
import type {
  InputContract,
  InputContractExample,
  RequestContentLike,
  RequestDefinition,
  RequestDefinitionSyncConflict,
  RequestExampleMeta,
  RequestExampleSource,
  RequestJsonSchema,
} from './types';
import { cloneRequestExampleValue, deletePathValue, getPathValue, isRecord } from './utils';

export type { InputContract, InputContractExample };

/**
 * InputContract（ADR-013）——输入节点唯一事实源。
 *
 * 存储纪律（additive）：契约整体存 `content.inputContract`；旧字段
 * （schema/schemaUI，examples 内嵌）保留为 legacy 读取回退，每次写契约时
 * 同步重生成镜像（双写）——旧版本 kernel / jdm-editor 读取镜像不丢数据。
 */
export const INPUT_CONTRACT_VERSION = 1;

export type RequestInputContractOrigin = 'contract' | 'legacy';

const EXAMPLES_FIELD = 'examples';
const EXAMPLES_META_FIELD = 'x-examples-meta';

// FNV-1a 双通道（不同偏移基、同质数）——仅作相等性锚点，非密码学散列；
// 规避 crypto.subtle 的安全上下文约束（ADR-007）。
export const requestSchemaFingerprint = (schema: unknown): string => {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(canonicalize);
    }

    if (isRecord(value)) {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = canonicalize(value[key]);
          return acc;
        }, {});
    }

    return value;
  };

  const text = JSON.stringify(canonicalize(schema ?? {}));
  let h1 = 0x811c9dc5;
  let h2 = (0x811c9dc5 ^ 0x9e3779b9) >>> 0;

  for (let index = 0; index < text.length; index += 1) {
    const charCode = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ charCode, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ charCode, 0x01000193) >>> 0;
  }

  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
};

const toRecordData = (data: unknown): Record<string, unknown> => (isRecord(data) ? { ...data } : { value: data });

const normalizeStoredExample = (example: unknown, index: number): InputContractExample => {
  const record = isRecord(example) ? example : {};
  return {
    id: typeof record.id === 'string' && record.id ? record.id : `contract-example-${index}`,
    name: typeof record.name === 'string' && record.name.trim() ? record.name : formatRequestExampleSourceName(index),
    description: typeof record.description === 'string' && record.description.trim() ? record.description : undefined,
    data: toRecordData(record.data),
    schemaFingerprint: typeof record.schemaFingerprint === 'string' ? record.schemaFingerprint : undefined,
  };
};

const normalizeStoredContract = (stored: Record<string, any>): InputContract => {
  const schema = parseRequestSchemaValue(stored.schema) ?? {};
  const examples = Array.isArray(stored.examples) ? stored.examples : [];

  return {
    contractVersion: typeof stored.contractVersion === 'number' ? stored.contractVersion : INPUT_CONTRACT_VERSION,
    schema,
    examples: examples.map((example, index) => normalizeStoredExample(example, index)),
  };
};

/** legacy 形态（examples 内嵌 schema）→ 契约投影。schema 文档剥离 examples / x-examples-meta。 */
const deriveContractFromLegacy = (content?: RequestContentLike | null): InputContract => {
  const resolvedSchema = resolveRequestSchemaValue(content, { includeExamples: true });
  const schemaExamples = Array.isArray(resolvedSchema?.[EXAMPLES_FIELD]) ? resolvedSchema?.[EXAMPLES_FIELD] : [];
  const schemaExamplesMeta = Array.isArray(resolvedSchema?.[EXAMPLES_META_FIELD])
    ? resolvedSchema?.[EXAMPLES_META_FIELD]
    : [];
  const schemaProper: RequestJsonSchema = {};

  if (resolvedSchema && isRecord(resolvedSchema)) {
    Object.entries(resolvedSchema).forEach(([key, value]) => {
      if (key !== EXAMPLES_FIELD && key !== EXAMPLES_META_FIELD) {
        schemaProper[key] = value;
      }
    });
  }

  const examples = schemaExamples.map((example, index) => {
    const meta: RequestExampleMeta | undefined = schemaExamplesMeta[index];
    return {
      id: `schema-example-${index}`,
      name: meta?.name?.trim() || formatRequestExampleSourceName(index),
      description: meta?.description?.trim() || undefined,
      data: toRecordData(example),
      schemaFingerprint: undefined,
    };
  });

  return { contractVersion: INPUT_CONTRACT_VERSION, schema: schemaProper, examples };
};

/**
 * 读契约：`content.inputContract` 优先，legacy（schema 内嵌 examples）回退投影。
 * 返回 origin 供「首次编辑迁移写入」判定。
 */
export const readRequestInputContract = (
  content?: RequestContentLike | null,
): { contract: InputContract; origin: RequestInputContractOrigin } => {
  const stored = isRecord(content?.inputContract) ? content?.inputContract : null;

  if (stored) {
    return { contract: normalizeStoredContract(stored), origin: 'contract' };
  }

  return { contract: deriveContractFromLegacy(content), origin: 'legacy' };
};

/**
 * 写契约（双写）：`content.inputContract` = 规范形态；legacy 镜像
 * （schemaUI/schema，examples + x-examples-meta 内嵌）同步重生成——
 * 旧版本 kernel / jdm-editor 打开同一张图不丢数据（interchange 硬约束）。
 */
export const writeRequestInputContract = (
  content: RequestContentLike & Record<string, any>,
  contract: InputContract,
): InputContract => {
  const nextContract: InputContract = {
    contractVersion: contract.contractVersion || INPUT_CONTRACT_VERSION,
    schema: isRecord(contract.schema) ? contract.schema : {},
    examples: contract.examples.map((example, index) => normalizeStoredExample(example, index)),
  };

  content.inputContract = {
    contractVersion: nextContract.contractVersion,
    schema: nextContract.schema,
    examples: nextContract.examples.map((example) => ({
      id: example.id,
      name: example.name,
      ...(example.description ? { description: example.description } : {}),
      data: cloneRequestExampleValue(example.data) as Record<string, unknown>,
      ...(example.schemaFingerprint ? { schemaFingerprint: example.schemaFingerprint } : {}),
    })),
  };

  setRequestSchemaValue(
    content,
    updateRequestSchemaExamples(
      nextContract.schema,
      nextContract.examples.map((example) => example.data),
      nextContract.examples.map((example) => ({ name: example.name, description: example.description })),
    ),
  );

  return nextContract;
};

/** 把带内嵌 examples 的 schema 文本并入契约：结构进 schema、内嵌 examples 按序替换示例集。 */
export const applySchemaTextToInputContract = (contract: InputContract, schemaText: string): InputContract => {
  const parsed = parseRequestSchemaValue(schemaText);

  if (!parsed) {
    return { contractVersion: contract.contractVersion, schema: {}, examples: contract.examples };
  }

  const embeddedExamples = Array.isArray(parsed[EXAMPLES_FIELD]) ? parsed[EXAMPLES_FIELD] : [];
  const embeddedMeta = Array.isArray(parsed[EXAMPLES_META_FIELD]) ? parsed[EXAMPLES_META_FIELD] : [];
  const schemaProper: RequestJsonSchema = {};

  Object.entries(parsed).forEach(([key, value]) => {
    if (key !== EXAMPLES_FIELD && key !== EXAMPLES_META_FIELD) {
      schemaProper[key] = value;
    }
  });

  if (embeddedExamples.length === 0) {
    return { contractVersion: contract.contractVersion, schema: schemaProper, examples: contract.examples };
  }

  const examples = embeddedExamples.map((example, index) => {
    const meta: RequestExampleMeta | undefined = embeddedMeta[index];
    const existing = contract.examples[index];

    return {
      id: existing?.id ?? `schema-example-${index}`,
      name: meta?.name?.trim() || existing?.name || formatRequestExampleSourceName(index),
      description: meta?.description?.trim() || existing?.description,
      data: toRecordData(example),
      schemaFingerprint: undefined,
    };
  });

  return { contractVersion: contract.contractVersion, schema: schemaProper, examples };
};

export const contractExamplesToSources = (
  contract: InputContract,
  options?: { dataLabel?: string },
): RequestExampleSource[] =>
  contract.examples.map((example, index) => ({
    id: example.id,
    name: example.name.trim() || formatRequestExampleSourceName(index, options?.dataLabel),
    description: example.description,
    data: { ...example.data },
    source: 'schema.examples',
  }));

/**
 * Drift 报告（评审裁定口径）：逐 example 重校验 + missing/extra/type-mismatch
 * 三类清单——不做全量 JSON Schema structural diff。
 */
export type RequestExampleDrift = {
  /** 定义了字段但 example 缺值 */
  missing: Array<Pick<RequestDefinition, 'name' | 'path' | 'type'>>;
  /** example 有值但定义不存在（嵌套路径被所属定义前缀覆盖的不算） */
  extra: string[];
  /** 类型不匹配（不安全漂移——迁移不动它，用户逐个决策） */
  conflicts: RequestDefinitionSyncConflict[];
};

export const computeExampleDrift = (
  data: Record<string, unknown>,
  definitions: Array<Pick<RequestDefinition, 'name' | 'path' | 'type'>>,
): RequestExampleDrift => {
  const validDefinitions = definitions.filter((definition) => definition.name.trim() && definition.path.trim());
  const conflicts = getRequestExampleDataDefinitionConflicts(data, validDefinitions);
  const missing = validDefinitions.filter((definition) => getPathValue(data, definition.path.trim()) === undefined);
  const dataPaths = collectExampleDataPaths(data);
  const definitionPaths = validDefinitions.map((definition) => definition.path.trim());
  const extra = dataPaths.filter(
    (dataPath) =>
      !definitionPaths.some(
        (definitionPath) => dataPath === definitionPath || dataPath.startsWith(`${definitionPath}.`),
      ),
  );

  return { missing, extra, conflicts };
};

export const hasExampleDrift = (drift: RequestExampleDrift): boolean =>
  drift.missing.length > 0 || drift.extra.length > 0 || drift.conflicts.length > 0;

/**
 * 安全迁移（ADR-013 §2）：缺值按定义默认值（无默认按类型零值）补齐、多余字段
 * 移除、datetime 归一化；类型冲突值**原样保留**（不安全漂移——用户逐个决策），
 * 经 conflicts 返回。
 */
export const migrateRequestExampleDataByDefinitions = (
  data: Record<string, unknown>,
  definitions: Array<Pick<RequestDefinition, 'name' | 'path' | 'type' | 'defaultValue'>>,
): { data: Record<string, unknown>; conflicts: RequestDefinitionSyncConflict[] } => {
  const validDefinitions = definitions.filter((definition) => definition.name.trim() && definition.path.trim());

  if (validDefinitions.length === 0) {
    return { data: cloneRequestExampleValue(data) as Record<string, unknown>, conflicts: [] };
  }

  const template = buildRequestExampleTemplateFromDefinitions(validDefinitions);
  const migrated = mergeRequestExampleDataWithTemplate(template, data);

  collectExampleDataPaths(migrated).forEach((dataPath) => {
    const coveredByDefinition = validDefinitions.some((definition) => {
      const definitionPath = definition.path.trim();
      return dataPath === definitionPath || dataPath.startsWith(`${definitionPath}.`);
    });

    if (!coveredByDefinition) {
      deletePathValue(migrated, dataPath);
    }
  });

  const normalized = normalizeRequestExampleDataByDefinitions(migrated, validDefinitions);

  return {
    data: normalized,
    conflicts: getRequestExampleDataDefinitionConflicts(normalized, validDefinitions),
  };
};

/**
 * 分享信封（spec §2 / ADR-013 §4，清单 #7）：{contractVersion, schema,
 * examples} 自包含交换物——OpenAPI / mock / 测试夹具 / 规则分享的共同根。
 * 不携带 schemaFingerprint：指纹锚是接收方自己的校验时点，导入后重新戳记。
 */
export type InputContractEnvelope = {
  contractVersion: number;
  schema: RequestJsonSchema;
  examples: Array<Pick<InputContractExample, 'id' | 'name' | 'description' | 'data'>>;
};

export const exportInputContractEnvelope = (contract: InputContract): InputContractEnvelope => ({
  contractVersion: contract.contractVersion || INPUT_CONTRACT_VERSION,
  schema: isRecord(contract.schema) ? contract.schema : {},
  examples: contract.examples.map((example) => ({
    id: example.id,
    name: example.name,
    ...(example.description ? { description: example.description } : {}),
    data: cloneRequestExampleValue(example.data) as Record<string, unknown>,
  })),
});

export type ParseInputContractEnvelopeResult =
  | { ok: true; contract: InputContract }
  | { ok: false; error: 'invalid-json' | 'invalid-shape' | 'unsupported-version' };

/** 支持的最低/当前信封版本——更高版本拒收（向前兼容：旧版本读新信封报版本错误而非静默丢数据） */
export const INPUT_CONTRACT_SUPPORTED_VERSION = INPUT_CONTRACT_VERSION;

/**
 * 解析分享信封。确定性（无随机）：缺失/重复的 id 置为 ''，由调用层在合并时
 * 铸造新 id（须对照既有契约的 id 空间）。
 */
export const parseInputContractEnvelope = (text: string): ParseInputContractEnvelopeResult => {
  let parsed: unknown;

  try {
    parsed = json5.parse(text);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }

  if (!isRecord(parsed) || !isRecord(parsed.schema) || !Array.isArray(parsed.examples)) {
    return { ok: false, error: 'invalid-shape' };
  }

  const contractVersion = parsed.contractVersion;
  if (typeof contractVersion !== 'number' || contractVersion > INPUT_CONTRACT_SUPPORTED_VERSION) {
    return { ok: false, error: 'unsupported-version' };
  }

  const seenIds = new Set<string>();
  const examples = parsed.examples.map((example, index) => {
    const record = isRecord(example) ? example : {};
    const rawId = typeof record.id === 'string' ? record.id.trim() : '';
    const id = rawId && !seenIds.has(rawId) ? rawId : '';
    seenIds.add(rawId);

    return {
      id,
      name: typeof record.name === 'string' && record.name.trim() ? record.name : formatRequestExampleSourceName(index),
      description: typeof record.description === 'string' && record.description.trim() ? record.description : undefined,
      data: toRecordData(record.data),
    };
  });

  return { ok: true, contract: { contractVersion, schema: parsed.schema, examples } };
};
