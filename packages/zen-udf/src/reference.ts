// 参考函数域装载（builtin: 'reference' 的实现核心）。
// import 本模块即向 globalUdfRegistry 注册全部 contrib 工具（各 contrib 模块的
// 模块级副作用：旧域经 defineContrib、新域（tool()/pack()）经模块内显式
// globalUdfRegistry.register）；需要装载到独立实例（多租户/多运行时隔离）时，
// 调用 loadReferenceInto(registry)。业务 UDF 包（verdict 侧）不应依赖本模块。
// 新风格域（ADR-011 示范迁移）：tool()/pack() 声明，经 register 唯一入口装载
import abBucketPack from './contrib/ab-bucket.ts';
import cryptoTools from './contrib/crypto.ts';
import customListQueryTools from './contrib/custom-list-query.ts';
import datetimeTools from './contrib/datetime.ts';
import debugTools from './contrib/debug.ts';
import debuguiTools from './contrib/debugui.ts';
import geoTools from './contrib/geo.ts';
import httpTools from './contrib/http.ts';
import ipLocationTools from './contrib/ip-location.ts';
import notifyTools from './contrib/notify.ts';
import rateWindowTools from './contrib/rate-window.ts';
import rosterTools from './contrib/roster.ts';
import templateTools from './contrib/template.ts';
import validateCnTools from './contrib/validate-cn.ts';
import { type ContribToolDef, type UdfRegistry, globalUdfRegistry } from './register.ts';
import { type UdfTool } from './tool.ts';

/** 旧风格域清单：[namespace, ContribToolDef[]]——namespace 与 contrib 文件名约定一致 */
export const referenceDomains: Array<[string, ContribToolDef[]]> = [
  ['crypto', cryptoTools],
  ['datetime', datetimeTools],
  ['custom-list-query', customListQueryTools],
  ['debug', debugTools],
  ['debugui', debuguiTools],
  ['geo', geoTools],
  ['http', httpTools],
  ['ip-location', ipLocationTools],
  ['notify', notifyTools],
  ['rate-window', rateWindowTools],
  ['roster', rosterTools],
  ['template', templateTools],
  ['validate-cn', validateCnTools],
];

/** 新风格域清单（tool()/pack()）：装载走 register 唯一入口 */
export const referencePacks: Array<UdfTool<any, any>[]> = [abBucketPack.tools];
export const referencePackIds = ['ab-bucket'];

/**
 * 参考域元数据（ADR-009）：origin=reference；version 随 zen-udf 发版同步更新
 * （与 package.json 一致，目录据此做过期提示）。
 */
export const REFERENCE_PACK_META = { origin: 'reference' as const, version: '0.11.0' };

/** 将参考函数域注册到任意注册表（实例隔离场景用；global 的注册由 import 副作用完成） */
export const loadReferenceInto = (registry: UdfRegistry): void => {
  for (const [namespace, tools] of referenceDomains) {
    registry.registerTools(tools, namespace);
    registry.setPackMeta(namespace, REFERENCE_PACK_META);
  }
  for (const tools of referencePacks) {
    registry.register({ id: 'ab-bucket', tools });
    registry.setPackMeta('ab-bucket', REFERENCE_PACK_META);
  }
};

// globalUdfRegistry 的参考域同样打标记（import 副作用注册路径的 meta 补录）
for (const [namespace] of referenceDomains) {
  globalUdfRegistry.setPackMeta(namespace, REFERENCE_PACK_META);
}
globalUdfRegistry.setPackMeta('ab-bucket', REFERENCE_PACK_META);
