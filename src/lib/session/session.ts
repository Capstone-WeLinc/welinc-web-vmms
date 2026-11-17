import { useAuthStore } from '../../store/authStore';
import type { UserRecord } from '../api/authService';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
export const PORTAL_URL = String(import.meta.env.VITE_PORTAL_URL ?? '').replace(/\/+$/, '');
const BOOT_FLAG = 'vmms_boot_attempt';
const LOCK_NAME = 'vmms-refresh';
const SESSION_STATUS_POLL_MS = 30_000;

type SessionAnswer = {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    roles: { role: string; system: string }[];
    systems?: string[];
  };
};

let refreshInFlight: Promise<string | null> | null = null;
let sessionStatusTimer: number | null = null;
let sessionStatusInFlight = false;

function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Polls the server's fresh account/session check so idle tabs leave after deactivation. */
async function checkSessionStatus(): Promise<void> {
  const { authenticated, token } = useAuthStore.getState();
  if (!authenticated || !token || sessionStatusInFlight) return;

  sessionStatusInFlight = true;
  try {
    const response = await fetch(apiUrl('/vmms/session/status'), {
      credentials: 'include',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (!refreshed && useAuthStore.getState().status !== 'unavailable') {
        handleSessionEnded();
      }
    } else if (response.status === 403) {
      handleSessionEnded();
    }
  } catch {
    // Keep the session during a temporary outage; the next poll will retry.
  } finally {
    sessionStatusInFlight = false;
  }
}

function startSessionStatusPolling(): void {
  if (typeof window === 'undefined' || sessionStatusTimer !== null) return;
  sessionStatusTimer = window.setInterval(() => void checkSessionStatus(), SESSION_STATUS_POLL_MS);
}

function stopSessionStatusPolling(): void {
  if (sessionStatusTimer === null || typeof window === 'undefined') return;
  window.clearInterval(sessionStatusTimer);
  sessionStatusTimer = null;
}

function asUser(answer: SessionAnswer['user']): UserRecord {
  const role = answer.roles.find((item) => item.system === 'VMMS')?.role;
  return {
    id: answer.id,
    name: answer.name,
    email: answer.email,
    role: role as UserRecord['role'],
    status: 'Active',
    lastActive: new Date().toISOString(),
    systems: Array.isArray(answer.systems) ? answer.systems : [],
  };
}

async function refreshRequest(): Promise<string | null> {
  try {
    const response = await fetch(apiUrl('/vmms/session/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) {
      if (response.status === 401) useAuthStore.getState().clearAuth();
      else useAuthStore.setState({ status: 'unavailable' });
      return null;
    }
    const answer = (await response.json()) as SessionAnswer;
    if (!answer.accessToken || !answer.user?.id) return null;
    const token = answer.accessToken;
    useAuthStore.getState().setSession(
      token,
      Date.now() + answer.expiresIn * 1000,
      asUser(answer.user),
    );
    startSessionStatusPolling();
    return token;
  } catch {
    useAuthStore.setState({ status: 'unavailable' });
    return null;
  }
}

/** Refreshes under a same-origin lock so tabs never rotate the cookie concurrently. */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  const work = () => refreshRequest();
  refreshInFlight = (locks
    ? (locks.request(LOCK_NAME, work) as unknown as Promise<string | null>)
    : work()
  ).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function bootSession(): Promise<void> {
  useAuthStore.setState({ status: 'booting' });
  if (!API_BASE) {
    useAuthStore.setState({ status: 'ready' });
    return;
  }
  const token = await refreshAccessToken();
  if (token) {
    sessionStorage.removeItem(BOOT_FLAG);
    return;
  }
  if (useAuthStore.getState().status === 'unavailable') return;
  const now = Date.now();
  const attemptedAt = Number(sessionStorage.getItem(BOOT_FLAG));
  if (Number.isFinite(attemptedAt) && attemptedAt <= now && now - attemptedAt < 120_000) {
    sessionStorage.removeItem(BOOT_FLAG);
    window.location.assign(`${PORTAL_URL}/?error=LOGIN_FAILED`);
    return;
  }
  sessionStorage.setItem(BOOT_FLAG, String(now));
  const returnTo = encodeURIComponent(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
  window.location.assign(apiUrl(`/vmms/session/start?return=${returnTo}`));
}

export async function signOut(): Promise<void> {
  const token = useAuthStore.getState().token;
  stopSessionStatusPolling();
  try {
    await fetch(apiUrl('/vmms/session/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: '{}',
    });
  } finally {
    useAuthStore.getState().clearAuth();
    window.location.assign(`${PORTAL_URL}/login?reason=logout`);
  }
}

export function handleSessionEnded(): void {
  stopSessionStatusPolling();
  useAuthStore.getState().clearAuth();
  window.location.assign(`${PORTAL_URL}/login?reason=idle`);
}

