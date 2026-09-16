/**
 * roster 名单数据源（可注入）：默认同源 `/api/rosters`（宿主后端实现名单列表契约，
 * 返回 `[{ name, size }]`）。跨源后端/本地夹具经 setRosterSource 注入。
 */

export interface RosterOption {
  name: string;
  size: number;
}

export type RosterSource = (query: string) => Promise<RosterOption[]>;

let rosterSource: RosterSource = async (query) => {
  try {
    const response = await fetch(`/api/rosters?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? (data as RosterOption[]) : [];
  } catch {
    return [];
  }
};

export const getRosterSource = (): RosterSource => rosterSource;

/** 宿主注入名单来源（跨源后端/本地夹具等）；与 setRosterSource 对应的恢复用 resetRosterSource */
export const setRosterSource = (source: RosterSource): void => {
  rosterSource = source;
};
