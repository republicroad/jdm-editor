import initWasm, { isReady } from '@gorules/zen-engine-wasm';
import { useEffect, useState } from 'react';

let wasmAvailable = false;
let wasmInitPromise: Promise<void> | null = null;
const wasmListeners = new Set<() => void>();

export const isWasmAvailable = () => {
  if (wasmAvailable) {
    return true;
  }

  try {
    if (isReady()) {
      wasmAvailable = true;
      return wasmAvailable;
    }
  } catch {
    return false;
  }
};

export const ensureWasmLoaded = (): Promise<void> => {
  if (isWasmAvailable()) {
    return Promise.resolve();
  }

  if (!wasmInitPromise) {
    // Explicit relative URL: resolves against document.baseURI so it works in
    // the dev server (root) and the Pages project sub-path. The glue's
    // import.meta.url default resolves to a build-asset URL that 404s on the
    // static site, and the staticDirs convention uses an absolute path that
    // 404s under https://republicroad.github.io/jdm-editor/.
    const wasmUrl = new URL('zen-engine-wasm/zen_engine_wasm_bg.wasm', document.baseURI).href;
    wasmInitPromise = initWasm({ module_or_path: wasmUrl })
      .then(() => {
        wasmAvailable = true;
        wasmListeners.forEach((fn) => fn());
        wasmListeners.clear();
      })
      .catch(() => {
        wasmInitPromise = null;
      });
  }

  return wasmInitPromise;
};

export const useWasmReady = (): boolean => {
  const [ready, setReady] = useState(() => !!isWasmAvailable());

  useEffect(() => {
    if (isWasmAvailable()) {
      setReady(true);
      return;
    }

    const listener = () => setReady(true);
    wasmListeners.add(listener);
    ensureWasmLoaded();

    return () => {
      wasmListeners.delete(listener);
    };
  }, []);

  return ready;
};

let warmupScheduled = false;

/**
 * A2 二期打磨：把 wasm 下载+编译挪出首次真实求值的临界路径。
 *
 * ensureWasmLoaded 此前只在 wasm 消费组件挂载（useWasmReady）时才被触发——
 * 用户首次跑表达式仍吃整段 fetch+编译延迟（实测 ~50ms 级：UDF Lab
 * current_date 首调 50138µs，2026-09-29；node 侧无此问题）。warmupZenEngine
 * 在 shell 挂载后的空闲窗口调度同一次装载：requestIdleCallback（3s 超时兜底
 * 防饥饿；不可用时 setTimeout 退化）。幂等：调度标记只挂一次，重复调用
 * no-op；装载本体由 ensureWasmLoaded 的 promise 缓存与失败复位兜底。
 *
 * 接线：appshell EditorShellProvider 挂载时调用（appshell 宿主默认全覆盖）；
 * 直嵌 kernel 的宿主可在合适时机自行调用。SSR/Node 无预热语义（no-op）。
 */
export const warmupZenEngine = (): void => {
  if (warmupScheduled || typeof window === 'undefined') return;
  warmupScheduled = true;

  const fire = () => {
    void ensureWasmLoaded();
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(fire, { timeout: 3000 });
  } else {
    setTimeout(fire, 200);
  }
};
