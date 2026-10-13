import type { Ajv2020, ErrorObject, ValidateFunction } from 'ajv/dist/2020';

import { requestSchemaFingerprint } from './contract';
import type { RequestJsonSchema } from './types';

/**
 * ajv 懒加载校验服务（ADR-013 OQ2 裁定：ajv core + 2020-12 模块）。
 *
 * - 动态 import → 独立异步 chunk，主入口体积预算不动（评审：预算上调需宿主裁，
 *   懒加载则无需上调）；
 * - 编译产物按 schema 指纹缓存——纯缓存（透明于语义，非权威状态）；
 * - 与指纹锚协议正交（ADR-013 实施注记）：约束违例是实时警告，不参与戳记。
 */

let ajvInstancePromise: Promise<Ajv2020> | null = null;
const compileCache = new Map<string, Promise<ValidateFunction>>();

const loadAjv = (): Promise<Ajv2020> => {
  // ajv-formats 随 ajv 同批懒加载——definitions 为 datetime 字段产出
  // format: 'date-time'，strict 模式下未知 format 会在编译期抛错，
  // 不注册 formats 则该 schema 的约束校验静默降级（2026-10-01 实测钉住）
  ajvInstancePromise ??= Promise.all([import('ajv/dist/2020'), import('ajv-formats')]).then(([mod, formats]) => {
    const ajv = new mod.default({ allErrors: true });
    formats.default(ajv);
    return ajv;
  });
  return ajvInstancePromise;
};

const loadValidator = (schema: RequestJsonSchema): Promise<ValidateFunction> => {
  const fingerprint = requestSchemaFingerprint(schema);
  let validatorPromise = compileCache.get(fingerprint);

  if (!validatorPromise) {
    validatorPromise = loadAjv().then((ajv) => ajv.compile(schema));
    compileCache.set(fingerprint, validatorPromise);
  }

  return validatorPromise;
};

const formatAjvError = (error: ErrorObject): string => `${error.instancePath || '/'} ${error.message ?? ''}`.trim();

/**
 * 单实例校验。schema 不可编译（非法关键字组合等）返回空清单——schema 自身
 * 的错误交回 Schema 页签编辑面反馈，不在实例校验层报错。
 */
export const validateExampleDataBySchema = async (data: unknown, schema: RequestJsonSchema): Promise<string[]> => {
  try {
    const validator = await loadValidator(schema);

    if (validator(data)) {
      return [];
    }

    return validator.errors?.map(formatAjvError) ?? [];
  } catch {
    return [];
  }
};

/** 批量校验：N 个 example 共享一次编译。 */
export const validateExampleDatasBySchema = async (
  datas: unknown[],
  schema: RequestJsonSchema,
): Promise<string[][]> => {
  try {
    const validator = await loadValidator(schema);

    return datas.map((data) => {
      if (validator(data)) {
        return [];
      }

      return validator.errors?.map(formatAjvError) ?? [];
    });
  } catch {
    return datas.map(() => []);
  }
};
