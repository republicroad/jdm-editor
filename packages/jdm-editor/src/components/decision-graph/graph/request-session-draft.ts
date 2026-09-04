import { useTabSerializer } from '../context/serializer.context';

/**
 * TabRequest 的 UI 会话草稿（serializer tab slice 载荷）。
 * 捕获 700ms 防抖窗口内尚未落 content 的在途编辑——历史条目=完整现场的一部分。
 */
export type RequestSessionDraft = {
  activeTab?: string;
  schemaDraft?: string;
  activeSourceIndex?: number;
  activeExampleJsonDraft?: string;
  activeDescriptionDraft?: string;
};

export type RequestSessionSnapshotInput = {
  activeTab: string;
  schemaDraft?: string;
  activeSourceIndex?: number;
  activeExampleJsonDraft?: string;
  activeDescriptionDraft?: string;
};

export function buildRequestSessionDraft(
  input: RequestSessionSnapshotInput,
): RequestSessionDraft {
  const draft: RequestSessionDraft = { activeTab: input.activeTab };
  if (input.schemaDraft !== undefined) draft.schemaDraft = input.schemaDraft;
  if (input.activeSourceIndex !== undefined) draft.activeSourceIndex = input.activeSourceIndex;
  if (input.activeExampleJsonDraft !== undefined) draft.activeExampleJsonDraft = input.activeExampleJsonDraft;
  if (input.activeDescriptionDraft !== undefined) draft.activeDescriptionDraft = input.activeDescriptionDraft;
  return draft;
}

export type RequestSessionDraftAppliers = {
  setActiveTab: (tab: string) => void;
  setSchemaDraft?: (value: string) => void;
  setActiveSourceIndex?: (index: number) => void;
  setActiveExampleJsonDraft?: (value: string) => void;
  setActiveDescriptionDraft?: (value: string) => void;
};

/** 将快照草稿回填到编辑器（缺省字段跳过；无草稿时整体跳过） */
export function applyRequestSessionDraft(
  draft: RequestSessionDraft | undefined,
  appliers: RequestSessionDraftAppliers,
): void {
  if (!draft) return;
  if (draft.activeTab !== undefined) appliers.setActiveTab(draft.activeTab);
  if (draft.schemaDraft !== undefined && appliers.setSchemaDraft) appliers.setSchemaDraft(draft.schemaDraft);
  if (draft.activeSourceIndex !== undefined && appliers.setActiveSourceIndex)
    appliers.setActiveSourceIndex(draft.activeSourceIndex);
  if (draft.activeExampleJsonDraft !== undefined && appliers.setActiveExampleJsonDraft)
    appliers.setActiveExampleJsonDraft(draft.activeExampleJsonDraft);
  if (draft.activeDescriptionDraft !== undefined && appliers.setActiveDescriptionDraft)
    appliers.setActiveDescriptionDraft(draft.activeDescriptionDraft);
}

/** TabRequest 便捷封装：注册 request 会话草稿 slice（泛型承载宿主的 tab 键枚举） */
export function useRequestSessionDraftSerializer(
  tabId: string,
  snapshot: RequestSessionSnapshotInput,
  appliers: RequestSessionDraftAppliers,
): void {
  useTabSerializer<RequestSessionDraft>(
    tabId,
    'request',
    {
      serialize: () => buildRequestSessionDraft(snapshot),
      restore: (draft) => applyRequestSessionDraft(draft, appliers),
    },
  );
}
