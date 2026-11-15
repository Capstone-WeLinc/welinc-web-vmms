import type { UserRecord } from '../mocks/vmmsMocks';
import { PORTAL_URL } from './session';

export function canSwitchSystem(user: Pick<UserRecord, 'systems' | 'role'> | null): boolean {
  return Boolean(user && ((user.systems?.length ?? 0) >= 2 || user.role === 'ADMIN'));
}

export function switchSystemUrl(portal = PORTAL_URL): string {
  return `${portal.replace(/\/+$/, '')}/?from=VMMS`;
}
