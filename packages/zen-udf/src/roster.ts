export interface Roster {
  name: string;
  description?: string;
  items: string[];
}

/**
 * 名单作用域（U5 租户化）：tenantId 必填；actor 缺省 = 租户共享，指定 actor = 该用户私有。
 * 可见性：自有 > 租户共享 > 不可见他人；无 actor（管理员）遍历本租户全域。跨租户永不可见。
 */
export interface RosterScope {
  tenantId: string;
  actor?: string;
}

interface TenantStore {
  /** 租户共享名单 */
  shared: Map<string, Roster>;
  /** actor → name → roster（用户私有名单） */
  private: Map<string, Map<string, Roster>>;
}

const tenants = new Map<string, TenantStore>();

const tenantOf = (tenantId: string): TenantStore => {
  let store = tenants.get(tenantId);
  if (!store) {
    store = { shared: new Map(), private: new Map() };
    tenants.set(tenantId, store);
  }
  return store;
};

interface ResolvedEntry {
  roster: Roster;
  /** 私有名单命中时的属主 actor；共享名单无属主 */
  ownerActor?: string;
}

const resolveRosterEntry = (name: string, scope: RosterScope): ResolvedEntry | null => {
  const tenant = tenants.get(scope.tenantId);
  if (!tenant) return null;
  if (scope.actor) {
    const own = tenant.private.get(scope.actor)?.get(name);
    if (own) return { roster: own, ownerActor: scope.actor };
    const shared = tenant.shared.get(name);
    if (shared) return { roster: shared };
    return null;
  }
  // 管理员（无 actor）：租户共享优先，其次遍历本租户私有域
  const shared = tenant.shared.get(name);
  if (shared) return { roster: shared };
  for (const [actor, map] of tenant.private) {
    const hit = map.get(name);
    if (hit) return { roster: hit, ownerActor: actor };
  }
  return null;
};

const assertScope = (scope: RosterScope): void => {
  if (!scope?.tenantId) {
    throw new Error('[roster] scope.tenantId is required');
  }
};

export const registerRoster = (roster: Roster, scope: RosterScope): void => {
  assertScope(scope);
  const tenant = tenantOf(scope.tenantId);
  const stored: Roster = { ...roster };
  if (scope.actor) {
    let own = tenant.private.get(scope.actor);
    if (!own) {
      own = new Map();
      tenant.private.set(scope.actor, own);
    }
    own.set(stored.name, stored);
  } else {
    tenant.shared.set(stored.name, stored);
  }
};

/** 解析 actor 可访问的名单：有 actor 时自有优先、租户共享次之、他人私有不可见；无 actor（管理员）共享优先、遍历本租户私有域 */
export const getRoster = (name: string, scope: RosterScope): Roster | undefined => {
  assertScope(scope);
  return resolveRosterEntry(name, scope)?.roster;
};

export const listRosters = (query: string | undefined, scope: RosterScope): Roster[] => {
  assertScope(scope);
  const tenant = tenants.get(scope.tenantId);
  if (!tenant) return [];
  const collected: Roster[] = [];
  if (scope.actor) {
    collected.push(...(tenant.private.get(scope.actor)?.values() ?? []));
    collected.push(...tenant.shared.values());
  } else {
    collected.push(...tenant.shared.values());
    for (const map of tenant.private.values()) collected.push(...map.values());
  }
  const q = query?.trim().toLowerCase() ?? '';
  const visible = q ? collected.filter((roster) => roster.name.toLowerCase().includes(q)) : collected;
  return visible.map((roster) => ({ ...roster }));
};

/** 删除名单；私有仅 owner 或本租户管理员可删，共享本租户任意调用方可删；返回是否存在且有权（便于 API 层区分 404） */
export const deleteRoster = (name: string, scope: RosterScope): boolean => {
  assertScope(scope);
  const entry = resolveRosterEntry(name, scope);
  if (!entry) return false;
  if (entry.ownerActor !== undefined && scope.actor !== undefined && scope.actor !== entry.ownerActor) {
    return false;
  }
  const tenant = tenants.get(scope.tenantId)!;
  if (entry.ownerActor !== undefined) {
    return tenant.private.get(entry.ownerActor)?.delete(name) ?? false;
  }
  return tenant.shared.delete(name);
};

export const queryRoster = (
  name: string,
  value: unknown,
  scope: RosterScope,
): { hit: boolean; roster: string; value: unknown } => {
  assertScope(scope);
  const roster = resolveRosterEntry(name, scope)?.roster;
  const hit = roster ? roster.items.some((item) => String(item) === String(value)) : false;
  return { hit, roster: roster?.name ?? name, value };
};
