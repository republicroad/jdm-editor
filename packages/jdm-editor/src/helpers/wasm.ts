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
