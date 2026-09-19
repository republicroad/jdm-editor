// 参考函数域装载（builtin: 'reference' 的实现核心）。
// import 本模块即向 globalUdfRegistry 注册全部 contrib 工具（各 contrib 模块的
// 模块级 defineContrib 副作用）；需要装载到独立实例（多租户/多运行时隔离）时，
// 调用 loadReferenceInto(registry)。业务 UDF 包（verdict 侧）不应依赖本模块。
import abBucketTools from './contrib/ab-bucket.ts';
import cryptoTools from './contrib/crypto.ts';
import customListQueryTools from './contrib/custom-list-query.ts';
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

/** 参考域清单：[namespace, tools]——namespace 与 contrib 文件名约定一致 */
export const referenceDomains: Array<[string, ContribToolDef[]]> = [
  ['ab', abBucketTools],
  ['crypto', cryptoTools],
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
  ['validate', validateCnTools],
];

/** 将参考函数域注册到任意注册表（实例隔离场景用；global 的注册由 import 副作用完成） */
export const loadReferenceInto = (registry: UdfRegistry): void => {
  for (const [namespace, tools] of referenceDomains) {
    registry.registerTools(tools, namespace);
  }
};

export { globalUdfRegistry };
