import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hermetic scheduling test: the glue is mocked so no real wasm fetch happens.
// Module state (wasmInitPromise / warmupScheduled) is reset per test via
// resetModules + dynamic import.
vi.mock('@gorules/zen-engine-wasm', () => ({
  default: vi.fn(() => Promise.resolve()),
  isReady: vi.fn(() => false),
}));

const loadModule = async () => {
  const wasm = await import('./wasm');
  return wasm;
};

describe('warmupZenEngine（A2 二期打磨：idle 预热调度）', () => {
  beforeEach(async () => {
    // resetModules refreshes ./wasm module state, but NOT the cached mock
    // spies — clear history and re-pin isReady so per-test overrides
    // (mockReturnValue(true)) cannot leak into the next test.
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('@gorules/zen-engine-wasm');
    vi.mocked(mod.isReady).mockReturnValue(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('jsdom 无 requestIdleCallback 时经 setTimeout 退化触发，URL 按 document.baseURI 解析', async () => {
    const initWasm = vi.mocked((await import('@gorules/zen-engine-wasm')).default);
    const { warmupZenEngine } = await loadModule();

    warmupZenEngine();
    expect(initWasm).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(initWasm).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(initWasm).mock.calls[0][0] as { module_or_path?: string };
    const url = arg.module_or_path as string;
    expect(url).toContain('zen-engine-wasm/zen_engine_wasm_bg.wasm');
    expect(url.startsWith(document.baseURI)).toBe(true);
  });

  it('幂等：重复调度只触发一次装载', async () => {
    const initWasm = vi.mocked((await import('@gorules/zen-engine-wasm')).default);
    const { warmupZenEngine } = await loadModule();

    warmupZenEngine();
    warmupZenEngine();
    warmupZenEngine();

    vi.advanceTimersByTime(250);
    expect(initWasm).toHaveBeenCalledTimes(1);
  });

  it('wasm 已就绪时预热为 no-op（isReady 短路，不重复 init）', async () => {
    const mod = await import('@gorules/zen-engine-wasm');
    vi.mocked(mod.isReady).mockReturnValue(true);
    const initWasm = vi.mocked(mod.default);
    const { warmupZenEngine } = await loadModule();

    warmupZenEngine();
    vi.advanceTimersByTime(250);
    expect(initWasm).not.toHaveBeenCalled();
  });

  it('预热后 useWasmReady 借同一装载通道转为 ready（监听器扇出不旁路）', async () => {
    const { act } = await import('@testing-library/react');
    const { warmupZenEngine, useWasmReady } = await loadModule();
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useWasmReady());
    expect(result.current).toBe(false);

    warmupZenEngine();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current).toBe(true);
  });
});
