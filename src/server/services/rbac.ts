import { sqlite } from '../db';

export type MemberRole = 'owner' | 'member' | 'client';

export function resolveAllowedClientName(organizationId: string, allowedClientId: string): string | null {
  if (!allowedClientId || allowedClientId === '*') return null;
  const row = sqlite
    .prepare('SELECT name FROM clients WHERE organization_id = ? AND (id = ? OR lower(name) = lower(?)) LIMIT 1')
    .get(organizationId, allowedClientId, allowedClientId) as { name: string } | undefined;
  return row?.name || allowedClientId;
}

export function parseUserDepartments(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
    } catch (_) {
      return raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
    }
  }
  return [];
}

export function isOrderAuthorizedForUser(params: {
  organizationId: string;
  memberRole: MemberRole;
  allowedClientId: string;
  userDepts: string[];
  userIdentifiers: string[];
  clientName?: string | null;
  sign?: string | null;
  routes?: Array<{ from?: string; to?: string; fromDept?: string; toDept?: string; sign?: string }>;
}): boolean {
  const { organizationId, memberRole, allowedClientId, userDepts, userIdentifiers, clientName, sign, routes } = params;
  if (memberRole === 'owner') return true;

  const allowedName = resolveAllowedClientName(organizationId, allowedClientId);
  const otClient = (clientName || '').trim().toLowerCase();

  if (memberRole === 'client') {
    if (!allowedName) return false;
    return otClient === allowedName.trim().toLowerCase();
  }

  // member
  if (allowedClientId === '*') return true;
  if (allowedName && otClient === allowedName.trim().toLowerCase()) return true;

  const signLower = (sign || '').trim().toLowerCase();
  if (signLower && userIdentifiers.includes(signLower)) return true;

  if (Array.isArray(routes)) {
    for (const r of routes) {
      const fromDept = (r.from || r.fromDept || '').trim().toLowerCase();
      const toDept = (r.to || r.toDept || '').trim().toLowerCase();
      const routeSign = (r.sign || '').trim().toLowerCase();
      if (fromDept && userDepts.includes(fromDept)) return true;
      if (toDept && userDepts.includes(toDept)) return true;
      if (routeSign && userIdentifiers.includes(routeSign)) return true;
    }
  }
  return false;
}

export function isOrderRowAuthorizedForUser(params: {
  organizationId: string;
  memberRole: MemberRole;
  allowedClientId: string;
  user: { id?: string; name?: string | null; email?: string | null } | null | undefined;
  otId: string;
  clientName?: string | null;
  sign?: string | null;
}): boolean {
  const { organizationId, memberRole, allowedClientId, user, otId, clientName, sign } = params;
  if (memberRole === 'owner') return true;

  const dbUser = user?.id
    ? (sqlite.prepare('SELECT short_name, departments FROM users WHERE id = ?').get(user.id) as any)
    : null;
  const userDepts = parseUserDepartments(dbUser?.departments);
  const userIdentifiers = [dbUser?.short_name, user?.name, user?.email]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim().toLowerCase());

  const existingRoutes = sqlite
    .prepare('SELECT from_dept, to_dept, sign FROM route_entries WHERE ot_id = ? AND organization_id = ?')
    .all(otId, organizationId) as Array<{ from_dept: string; to_dept: string; sign: string }>;

  return isOrderAuthorizedForUser({
    organizationId,
    memberRole,
    allowedClientId,
    userDepts,
    userIdentifiers,
    clientName,
    sign,
    routes: existingRoutes.map((r) => ({ fromDept: r.from_dept, toDept: r.to_dept, sign: r.sign })),
  });
}
