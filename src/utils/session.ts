export const SESSION_MAX_MS = 24 * 60 * 60 * 1000; // 24 hours
export const INACTIVITY_MS = 10 * 1000; // 10 seconds

const LOGIN_KEY = 'sessionLoginTime';
const LAST_KEY = 'sessionLastActivity';

export function setLoginTime(date = new Date()): void {
  window.localStorage.setItem(LOGIN_KEY, date.toISOString());
}

export function setLastActivity(date = new Date()): void {
  window.localStorage.setItem(LAST_KEY, date.toISOString());
}

export function clearSession(): void {
  window.localStorage.removeItem(LOGIN_KEY);
  window.localStorage.removeItem(LAST_KEY);
}

export function getLoginTime(): Date | null {
  const raw = window.localStorage.getItem(LOGIN_KEY);
  return raw ? new Date(raw) : null;
}

export function getLastActivity(): Date | null {
  const raw = window.localStorage.getItem(LAST_KEY);
  return raw ? new Date(raw) : null;
}

export function msUntilAbsoluteExpiry(): number {
  const login = getLoginTime();
  if (!login) return Infinity;
  return login.getTime() + SESSION_MAX_MS - Date.now();
}

export function msUntilInactivityExpiry(): number {
  const last = getLastActivity() || new Date();
  return last.getTime() + INACTIVITY_MS - Date.now();
}

export function isAbsoluteExpired(): boolean {
  return msUntilAbsoluteExpiry() <= 0;
}

export function isInactivityExpired(): boolean {
  return msUntilInactivityExpiry() <= 0;
}
