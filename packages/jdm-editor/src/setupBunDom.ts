import { GlobalRegistrator } from '@happy-dom/global-registrator';

// GlobalRegistrator 会用 happy-dom 实现覆盖全局 fetch/网络与事件基类，
// 导致同进程内真实网络测试失效(如 AbortSignal 被替换后原生 fetch 无法识别超时信号)——先存原生引用再还原
const nativeGlobals: Array<[string, unknown]> = [
  ['fetch', globalThis.fetch],
  ['Request', globalThis.Request],
  ['Response', globalThis.Response],
  ['Headers', globalThis.Headers],
  ['AbortController', globalThis.AbortController],
  ['AbortSignal', globalThis.AbortSignal],
  ['Event', globalThis.Event],
  ['EventTarget', globalThis.EventTarget],
];

GlobalRegistrator.register();

for (const [key, value] of nativeGlobals) {
  if (value !== undefined) {
    (globalThis as Record<string, unknown>)[key] = value;
  }
}


