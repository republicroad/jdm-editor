export interface Roster {
  name: string;
  description?: string;
  items: string[];
  owner?: string;
}

/** 外层键为归属域(''=共享, 其余=owner id), 内层键为名单名; 同名时自有遮蔽共享 */
const scopes = new Map<string, Map<string, Roster>>();

const scopeOf = (owner?: string): Map<string, Roster> => {
  const key = owner ?? '';
  let map = scopes.get(key);
  if (!map) {
    map = new Map<string, Roster>();
    scopes.set(key, map);
  }
  return map;
};

export const registerRoster = (roster: Roster, owner?: string): void => {
  const effective = owner ?? roster.owner;
  const stored: Roster = effective !== undefined ? { ...roster, owner: effective } : { ...roster, owner: undefined };
  scopeOf(effective).set(stored.name, stored);
};

type ScopeEntry = { roster: Roster; scopeKey: string };

/** 解析 actor 可访问的名单: 有 actor 时自有优先、他人私有不可见; 无 actor(管理员)共享优先、遍历全部 */
const resolveRosterEntry = (name: string, actor?: string): ScopeEntry | null => {
  if (actor !== undefined) {
    const own = scopes.get(actor)?.get(name);
    if (own) return { roster: own, scopeKey: actor };
    const shared = scopes.get('')?.get(name);
    if (shared) return { roster: shared, scopeKey: '' };
    return null;
  }
  const shared = scopes.get('')?.get(name);
  if (shared) return { roster: shared, scopeKey: '' };
  for (const [key, map] of scopes) {
    if (key === '') continue;
    const hit = map.get(name);
    if (hit) return { roster: hit, scopeKey: key };
  }
  return null;
};

export const getRoster = (name: string, actor?: string): Roster | undefined => resolveRosterEntry(name, actor)?.roster;

export const listRosters = (query?: string, actor?: string): Roster[] => {
  const collected: Roster[] = [];
  if (actor !== undefined) {
    collected.push(...(scopes.get(actor)?.values() ?? []));
    collected.push(...(scopes.get('')?.values() ?? []));
  } else {
    for (const map of scopes.values()) collected.push(...map.values());
  }
  const q = query?.trim().toLowerCase() ?? '';
  const visible = q ? collected.filter((roster) => roster.name.toLowerCase().includes(q)) : collected;
  return visible.map((roster) => ({ ...roster }));
};

/** 删除名单; 私有仅 owner 或管理员可删, 共享任意调用方可删; 返回是否存在且有权(便于 API 层区分 404) */
export const deleteRoster = (name: string, actor?: string): boolean => {
  const entry = resolveRosterEntry(name, actor);
  if (!entry) return false;
  if (entry.roster.owner !== undefined && actor !== undefined && entry.roster.owner !== actor) {
    return false;
  }
  return scopes.get(entry.scopeKey)?.delete(name) ?? false;
};

export const queryRoster = (
  name: string,
  value: unknown,
  actor?: string,
): { hit: boolean; roster: string; value: unknown } => {
  const roster = resolveRosterEntry(name, actor)?.roster;
  const hit = roster ? roster.items.some((item) => String(item) === String(value)) : false;
  return { hit, roster: roster?.name ?? name, value };
};
