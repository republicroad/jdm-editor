import { useEffect, useRef } from 'react';

export const AUTO_SYNC_DEBOUNCE_MS = 700;

export type UseSimulatorAutoSyncParams = {
  /** 绑定解析成功且存在 input 节点时启用 */
  enabled: boolean;
  /** 编辑器当前内容 */
  requestValue: string | undefined;
  /** schema.examples 当前序列化签名（外部变更检测） */
  requestSourcesSignature: string;
  /** 命中绑定源下标；<0 表示无可绑定源 */
  boundRequestSourceIndex: number;
  /** 编辑器内容持久化到 schema.examples（含类型归一，静默） */
  onSyncToSchema: () => void;
  /** schema 侧数据推送到编辑器（外部编辑反写） */
  onPushToEditor: () => void;
  /** 防抖时长（默认 700ms；测试注入短时长） */
  debounceMs?: number;
};

/**
 * Simulator 用例数据双向自动同步：
 * - 编辑器变更（去抖，静默）→ onSyncToSchema
 * - schema.examples 外部变更（签名守卫防回灌）→ onPushToEditor
 * - flush()：源切换/卸载前冲刷未落盘编辑
 */
export const useSimulatorAutoSync = ({
  enabled,
  requestValue,
  requestSourcesSignature,
  boundRequestSourceIndex,
  onSyncToSchema,
  onPushToEditor,
  debounceMs = AUTO_SYNC_DEBOUNCE_MS,
}: UseSimulatorAutoSyncParams) => {
  const pendingAutoSyncRef = useRef<number | null>(null);
  const lastAutoSyncedRequestRef = useRef<string | undefined>(undefined);
  const requestValueRef = useRef(requestValue);
  requestValueRef.current = requestValue;
  const lastPushedSourcesSignatureRef = useRef<string | undefined>(undefined);
  const callbacksRef = useRef({ onSyncToSchema, onPushToEditor });
  callbacksRef.current = { onSyncToSchema, onPushToEditor };

  /** 冲刷未落盘编辑（源切换前调用，以当前编辑器内容立即持久化） */
  const flush = () => {
    if (pendingAutoSyncRef.current === null) {
      return;
    }
    window.clearTimeout(pendingAutoSyncRef.current);
    pendingAutoSyncRef.current = null;
    lastAutoSyncedRequestRef.current = requestValueRef.current;
    callbacksRef.current.onSyncToSchema();
  };

  // 编辑器 → schema（去抖，静默）
  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (requestValue === lastAutoSyncedRequestRef.current) {
      return;
    }
    if (pendingAutoSyncRef.current !== null) {
      window.clearTimeout(pendingAutoSyncRef.current);
    }
    pendingAutoSyncRef.current = window.setTimeout(() => {
      pendingAutoSyncRef.current = null;
      lastAutoSyncedRequestRef.current = requestValueRef.current;
      callbacksRef.current.onSyncToSchema();
    }, debounceMs);
    return () => {
      if (pendingAutoSyncRef.current !== null) {
        window.clearTimeout(pendingAutoSyncRef.current);
        pendingAutoSyncRef.current = null;
      }
    };
  }, [debounceMs, enabled, requestValue]);

  // schema → 编辑器（签名守卫防回灌）
  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (requestSourcesSignature === lastPushedSourcesSignatureRef.current) {
      return;
    }
    lastPushedSourcesSignatureRef.current = requestSourcesSignature;
    if (boundRequestSourceIndex >= 0) {
      callbacksRef.current.onPushToEditor();
    }
  }, [boundRequestSourceIndex, enabled, requestSourcesSignature]);

  return { flush };
};
