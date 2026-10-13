import { z } from 'zod';

import { parseRequestSchemaValue, stringifyRequestSchemaValue } from './request-schema';
import { isRecord } from './request-schema/utils';

export const DECISION_GRAPH_CONTENT_TYPE = 'application/vnd.gorules.decision';
const id = z.string().default(() => crypto.randomUUID());

const enumValueSchema = z.object({ label: z.string(), value: z.string() });

export const columnEnumSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('inline'), values: z.array(enumValueSchema), loose: z.boolean().optional() }),
  z.object({ type: z.literal('ref'), ref: z.string(), loose: z.boolean().optional() }),
]);
export type ColumnEnum = z.infer<typeof columnEnumSchema>;

export const columnFieldTypeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('any') }),
  z.object({ type: z.literal('string'), enum: columnEnumSchema.optional() }),
  z.object({ type: z.literal('number') }),
  z.object({ type: z.literal('boolean') }),
  z.object({ type: z.literal('date') }),
]);
export type ColumnFieldType = z.infer<typeof columnFieldTypeSchema>;

export const COLUMN_FIELD_TYPE_OPTIONS: { value: ColumnFieldType['type']; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
];

export const outputFieldTypeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auto') }),
  z.object({ type: z.literal('string'), enum: columnEnumSchema.optional() }),
  z.object({ type: z.literal('string-array'), enum: columnEnumSchema.optional() }),
  z.object({ type: z.literal('number') }),
  z.object({ type: z.literal('boolean') }),
  z.object({ type: z.literal('date') }),
]);
export type OutputFieldType = z.infer<typeof outputFieldTypeSchema>;

export const OUTPUT_FIELD_TYPE_OPTIONS: { value: OutputFieldType['type']; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'string', label: 'Text' },
  { value: 'string-array', label: 'Text[]' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
];

export enum NodeKind {
  Input = 'inputNode',
  Output = 'outputNode',
  DecisionTable = 'decisionTableNode',
  Function = 'functionNode',
  Expression = 'expressionNode',
  Switch = 'switchNode',
  Decision = 'decisionNode',
}

export const CustomKind = 'customNode';

const nodeCommon = z.object({
  id,
  name: z.string(),
  position: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
});

export const inputNodeSchema = z
  .object({
    type: z.literal(NodeKind.Input),
    content: z
      .object({
        schema: z
          .union([z.string(), z.record(z.string(), z.any())])
          .nullish()
          .transform((val) => stringifyRequestSchemaValue(val)),
        expressions: z
          .array(
            z.object({
              id,
              key: z.string().default(''),
              value: z.any().default(''),
              type: z.string().optional(),
            }),
          )
          .default([]),
        inputField: z
          .string()
          .nullish()
          .default(null)
          .transform((val) => (val && val.trim().length > 0 ? val : null)),
        outputPath: z
          .string()
          .nullish()
          .default(null)
          .transform((val) => (val && val.trim().length > 0 ? val : null)),
        // InputContract（ADR-013）——必须显式声明：safeParse 会剥掉未声明键
        // （edgeSchema.name 同类事故）。legacy 图无此字段 → 保持缺失（nullish
        // 不物化键），首次编辑后由契约层写入。
        inputContract: z
          .object({
            contractVersion: z.number().default(1),
            schema: z
              .union([z.string(), z.record(z.string(), z.any())])
              .nullish()
              .transform((val) => (isRecord(val) ? val : (parseRequestSchemaValue(val) ?? {}))),
            examples: z
              .array(
                z.object({
                  id: z.string(),
                  name: z.string().default(''),
                  description: z.string().nullish(),
                  data: z.record(z.string(), z.any()).default({}),
                  schemaFingerprint: z.string().nullish(),
                }),
              )
              .default([]),
          })
          .nullish(),
      })
      .default({
        schema: '',
        expressions: [],
        inputField: null,
        outputPath: null,
      }),
  })
  .merge(nodeCommon);

export const outputNodeSchema = z
  .object({
    type: z.literal(NodeKind.Output),
    content: z
      .object({
        schema: z
          .string()
          .nullish()
          .transform((val) => val ?? ''),
      })
      .default({
        schema: '',
      }),
  })
  .merge(nodeCommon);

export const decisionTableSchema = z
  .object({
    type: z.literal(NodeKind.DecisionTable),
    content: z.object({
      hitPolicy: z
        .enum(['first', 'collect'])
        .nullish()
        .transform((val) => val ?? 'first'),
      rules: z
        .array(
          z.record(
            z.string(),
            z
              .string()
              .nullish()
              .transform((val) => val ?? ''),
          ),
        )
        .default([]),
      inputs: z.array(
        z.object({
          id,
          name: z.string().nullish(),
          field: z.string().nullish(),
          defaultValue: z.string().nullish(),
          fieldType: columnFieldTypeSchema.nullish(),
        }),
      ),
      outputs: z.array(
        z.object({
          id,
          name: z.string(),
          field: z.string(),
          defaultValue: z.string().nullish(),
          outputFieldType: outputFieldTypeSchema.nullish(),
        }),
      ),
      passThrough: z
        .boolean()
        .nullish()
        .transform((val) => val ?? false),
      inputField: z
        .string()
        .nullish()
        .default(null)
        .transform((val) => (val && val.trim().length > 0 ? val : null)),
      outputPath: z
        .string()
        .nullish()
        .default(null)
        .transform((val) => (val && val.trim().length > 0 ? val : null)),
      executionMode: z
        .enum(['single', 'loop'])
        .nullish()
        .transform((val) => val ?? 'single'),
    }),
  })
  .merge(nodeCommon);

export const functionNodeSchema = z
  .object({
    type: z.literal(NodeKind.Function),
    content: z
      .string()
      .or(
        z.object({
          source: z.string().default(''),
        }),
      )
      .nullish(),
  })
  .merge(nodeCommon);

export const expressionNodeSchema = z
  .object({
    type: z.literal(NodeKind.Expression),
    content: z.object({
      expressions: z.array(
        z.object({
          id,
          key: z.string().default(''),
          value: z.string().default(''),
        }),
      ),
      passThrough: z
        .boolean()
        .nullish()
        .transform((val) => val ?? false),
      inputField: z
        .string()
        .nullish()
        .default(null)
        .transform((val) => (val && val.trim().length > 0 ? val : null)),
      outputPath: z
        .string()
        .nullish()
        .default(null)
        .transform((val) => (val && val.trim().length > 0 ? val : null)),
      executionMode: z
        .enum(['single', 'loop'])
        .nullish()
        .transform((val) => val ?? 'single'),
    }),
  })
  .merge(nodeCommon);

export const decisionNodeSchema = z
  .object({
    type: z.literal(NodeKind.Decision),
    content: z.object({
      key: z.string(),
      passThrough: z
        .boolean()
        .nullish()
        .transform((val) => val ?? false),
      inputField: z
        .string()
        .nullish()
        .default(null)
        .transform((val) => (val && val.trim().length > 0 ? val : null)),
      outputPath: z
        .string()
        .nullish()
        .default(null)
        .transform((val) => (val && val.trim().length > 0 ? val : null)),
      executionMode: z
        .enum(['single', 'loop'])
        .nullish()
        .transform((val) => val ?? 'single'),
    }),
  })
  .merge(nodeCommon);

export const switchNodeSchema = z
  .object({
    type: z.literal(NodeKind.Switch),
    content: z.object({
      hitPolicy: z
        .enum(['first', 'collect'])
        .nullish()
        .transform((val) => val ?? 'first'),
      statements: z.array(
        z.object({
          id,
          condition: z
            .string()
            .nullish()
            .transform((val) => val ?? ''),
          isDefault: z
            .boolean()
            .nullish()
            .transform((val) => val ?? false),
          // WS1-R4：case 名——镜像为出边 edge.name（分支路径标签芯片）。
          // zod 默认剥离未声明键：不声明它，JSON 上传路径（safeParse）会静默丢名。
          name: z
            .string()
            .nullish()
            .transform((val) => (val && val.trim() !== '' ? val : undefined)),
        }),
      ),
    }),
  })
  .merge(nodeCommon);

export const customNodeSchema = z
  .object({
    type: z.literal(CustomKind),
    content: z.object({
      kind: z.string(),
      // z.any() 是特性不是疏忽（自定义节点编辑面规格 §1）：config 的形状由
      // pack 的 parametersSchema 定义（运行时契约），编辑器 zod 刻意无感知——
      // 收紧成严格 schema 会重引 safeParse 剥键事故（pack 自有键丢失）。
      // 键主权与写手纪律见 docs/design/custom-node-config-spec.md。
      config: z.any(),
    }),
  })
  .merge(nodeCommon);

export const anyNodeSchema = z
  .object({
    type: z.string().refine((val) => !(Object.values(NodeKind) as string[]).includes(val), {
      message: 'Invalid type',
    }),
    content: z.any().nullish(),
  })
  .merge(nodeCommon);

export const nodeSchema = z
  .discriminatedUnion('type', [
    decisionNodeSchema,
    expressionNodeSchema,
    functionNodeSchema,
    decisionTableSchema,
    switchNodeSchema,
    customNodeSchema,
    inputNodeSchema,
    outputNodeSchema,
  ])
  .or(anyNodeSchema);

export const edgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  sourceHandle: z.string().nullish(),
  type: z.enum(['edge']),
  // WS1-R4：分支路径标签数据源（mapToGraphEdge label ← edge.name）。
  // 不声明它，JSON 上传路径（safeParse）会剥掉所有边名——芯片上传后全部消失。
  name: z
    .string()
    .nullish()
    .transform((val) => (val && val.trim() !== '' ? val : undefined)),
});

export const validationSchema = z.object({
  inputSchema: z.any().nullish().default(null),
  outputSchema: z.any().nullish().default(null),
});

export const decisionModelSchema = z.object({
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([]),
});
