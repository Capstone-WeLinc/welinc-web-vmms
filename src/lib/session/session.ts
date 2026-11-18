import { useAuthStore } from '../../store/authStore';
import type { UserRecord } from '../api/authService';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
export const PORTAL_URL = String(import.meta.env.VITE_PORTAL_URL ?? '').replace(/\/+$/, '');
const BOOT_FLAG = 'vmms_boot_attempt';
const LOCK_NAME = 'vmms-refresh';
const CHANNEL_NAME = 'vmms-session';
const SESSION_STATUS_POLL_MS = 30_000;
const IDLE_WARNING_MS = 60_000;
const ACTIVITY_GAP_MS = 60_000;
const STATUS_RETRY_MS = 15_000;
const CUTOFF_SLACK_MS = 5_000;
const INPUT_EVENTS = ['keydown', 'pointerdown', 'touchstart', 'wheel'] as const;

type SessionAnswer = {
  accessToken: string;
  expiresIn: number;
  sessionExpiresAt: string;
  sessionAbsoluteExpiresAt?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    roles: { role: string; system: string }[];
    systems?: string[];
  };
};

type SessionStatusAnswer = { sessionExpiresAt: string };
type SessionEndReason = 'idle' | 'maxage' | 'logout';
type SessionStatusResult =
  | { kind: 'ok'; sessionExpiresAt: string }
  | { kind: 'ended' }
  | { kind: 'unavailable' };
type SessionMessage =
  | {
      type: 'refresh';
      accessToken: string;
      expiresAt: number;
      sessionExpiresAt: string;
      sessionAbsoluteExpiresAt: string | null;
      user: UserRecord;
    }
  | { type: 'extended' }
  | { type: 'ended'; reason: SessionEndReason };

let refreshInFlight: Promise<string | null> | null = null;
let sessionStatusTimer: number | null = null;
let idleTimer: number | null = null;
let activityTimer: number | null = null;
let sessionStatusGeneration = 0;
let sessionStatusInFlight: {
  generation: number;
  promise: Promise<SessionStatusResult>;
} | null = null;
let lastActivityPingAt = 0;
let listeningForActivity = false;
let leaving = false;

const channel: BroadcastChannel | null =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);

function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function isMaxAge(cutoff: number): boolean {
  const absoluteEnd = Date.parse(useAuthStore.getState().sessionAbsoluteExpiresAt ?? '');
  return Number.isFinite(absoluteEnd) && cutoff >= absoluteEnd - 1_000;
}

function reasonForCutoff(cutoff: number): SessionEndReason {
  return isMaxAge(cutoff) ? 'maxage' : 'idle';
}

function applySessionCutoff(sessionExpiresAt: string): void {
  const cutoff = Date.parse(sessionExpiresAt);
  if (!Number.isFinite(cutoff)) {
    console.error('[Session] The session status response contained an invalid cutoff.');
    return;
  }

  const now = Date.now();
  useAuthStore.setState({ sessionExpiresAt });
  if (idleTimer !== null) window.clearTimeout(idleTimer);

  if (cutoff <= now) {
    handleSessionEnded(reasonForCutoff(cutoff));
    return;
  }

  if (cutoff - now > IDLE_WARNING_MS + CUTOFF_SLACK_MS) {
    useAuthStore.setState({ idleWarning: null });
    idleTimer = window.setTimeout(() => {
      idleTimer = null;
      void checkSessionStatus();
    }, cutoff - now - IDLE_WARNING_MS);
    return;
  }

  const previous = useAuthStore.getState().idleWarning;
  useAuthStore.setState({
    idleWarning: {
      cutoff,
      cannotExtend: isMaxAge(cutoff),
      busy: false,
      dismissed: previous?.cutoff === cutoff ? previous.dismissed : false,
    },
  });
  if (activityTimer !== null) {
    window.clearTimeout(activityTimer);
    activityTimer = null;
  }
  idleTimer = window.setTimeout(() => {
    idleTimer = null;
    void checkSessionStatus();
  }, cutoff - now);
}

async function readSessionStatus(retryAfterRefresh = true): Promise<SessionStatusResult> {
  const { token } = useAuthStore.getState();
  if (!token) return { kind: 'ended' };

  let response: Response;
  try {
    response = await fetch(apiUrl('/vmms/session/status'), {
      credentials: 'include',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    console.warn('[Session] Could not reach the session status endpoint.', error);
    return { kind: 'unavailable' };
  }

  if (response.status === 401 && retryAfterRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return readSessionStatus(false);
    return useAuthStore.getState().status === 'unavailable'
      ? { kind: 'unavailable' }
      : { kind: 'ended' };
  }
  if (response.status === 401 || response.status === 403) return { kind: 'ended' };
  if (!response.ok) {
    console.warn(`[Session] Status check returned HTTP ${response.status}.`);
    return { kind: 'unavailable' };
  }

  try {
    const answer = (await response.json()) as SessionStatusAnswer;
    if (
      typeof answer.sessionExpiresAt !== 'string' ||
      !Number.isFinite(Date.parse(answer.sessionExpiresAt))
    ) {
      console.error('[Session] The session status endpoint returned an invalid answer.');
      return { kind: 'unavailable' };
    }
    return { kind: 'ok', sessionExpiresAt: answer.sessionExpiresAt };
  } catch (error) {
    console.warn('[Session] Could not read the session status response.', error);
    return { kind: 'unavailable' };
  }
}

function fetchSessionStatus(): Promise<SessionStatusResult> {
  const generation = sessionStatusGeneration;
  if (sessionStatusInFlight?.generation === generation) return sessionStatusInFlight.promise;
  const request = readSessionStatus().finally(() => {
    if (sessionStatusInFlight?.generation === generation) sessionStatusInFlight = null;
  });
  sessionStatusInFlight = { generation, promise: request };
  return request;
}

/** Polls for account changes and schedules the idle warning from the server's cutoff. */
async function checkSessionStatus(): Promise<void> {
  const { authenticated, token, sessionExpiresAt } = useAuthStore.getState();
  if (!authenticated || !token || leaving) return;

  const knownCutoff = Date.parse(sessionExpiresAt ?? '');
  const knownMaxAge = Number.isFinite(knownCutoff) && isMaxAge(knownCutoff);
  const generation = sessionStatusGeneration;
  const result = await fetchSessionStatus();
  if (generation !== sessionStatusGeneration || leaving) return;
  if (result.kind === 'ended') {
    handleSessionEnded(
      Number.isFinite(knownCutoff) && knownCutoff <= Date.now()
        ? knownMaxAge ? 'maxage' : 'idle'
        : 'idle',
    );
    return;
  }
  if (!useAuthStore.getState().authenticated) return;
  if (result.kind === 'unavailable') {
    if (idleTimer === null) {
      idleTimer = window.setTimeout(() => {
        idleTimer = null;
        void checkSessionStatus();
      }, STATUS_RETRY_MS);
    }
    return;
  }
  applySessionCutoff(result.sessionExpiresAt);
}

async function sendActivity(): Promise<'ok' | 'ended' | 'unavailable'> {
  const { token } = useAuthStore.getState();
  if (!token || !API_BASE) return 'ended';
  lastActivityPingAt = Date.now();

  try {
    const response = await fetch(apiUrl('/vmms/session/activity'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: '{}',
    });
    if (response.status === 401) return 'ended';
    if (!response.ok) {
      console.warn(`[Session] Activity ping returned HTTP ${response.status}.`);
      return 'unavailable';
    }
    sessionStatusGeneration += 1;
    channel?.postMessage({ type: 'extended' } satisfies SessionMessage);
    return 'ok';
  } catch (error) {
    console.warn('[Session] Could not send an activity ping.', error);
    return 'unavailable';
  }
}

async function pingFromInput(): Promise<void> {
  const cutoff = Date.parse(useAuthStore.getState().sessionExpiresAt ?? '');
  const reason = Number.isFinite(cutoff) ? reasonForCutoff(cutoff) : 'idle';
  const result = await sendActivity();
  if (result === 'ended') handleSessionEnded(reason);
}

function onUserActivity(event: Event): void {
  if (!event.isTrusted || leaving) return;
  const { authenticated, token, idleWarning } = useAuthStore.getState();
  if (!authenticated || !token || idleWarning || activityTimer !== null) return;

  const delay = Math.max(0, lastActivityPingAt + ACTIVITY_GAP_MS - Date.now());
  activityTimer = window.setTimeout(() => {
    activityTimer = null;
    const current = useAuthStore.getState();
    if (!current.authenticated || !current.token || current.idleWarning) return;
    void pingFromInput();
  }, delay);
}

function startActivityTracking(): void {
  if (typeof window === 'undefined' || listeningForActivity) return;
  listeningForActivity = true;
  for (const eventName of INPUT_EVENTS) {
    window.addEventListener(eventName, onUserActivity, { capture: true, passive: true });
  }
}

function stopActivityTracking(): void {
  if (typeof window === 'undefined') return;
  for (const eventName of INPUT_EVENTS) {
    window.removeEventListener(eventName, onUserActivity, true);
  }
  listeningForActivity = false;
  if (activityTimer !== null) window.clearTimeout(activityTimer);
  activityTimer = null;
}

function startSessionStatusPolling(): void {
  if (typeof window === 'undefined' || sessionStatusTimer !== null) return;
  startActivityTracking();
  const cutoff = useAuthStore.getState().sessionExpiresAt;
  if (cutoff) applySessionCutoff(cutoff);
  sessionStatusTimer = window.setInterval(() => void checkSessionStatus(), SESSION_STATUS_POLL_MS);
}

function stopSessionStatusPolling(): void {
  if (typeof window !== 'undefined') {
    if (sessionStatusTimer !== null) window.clearInterval(sessionStatusTimer);
    if (idleTimer !== null) window.clearTimeout(idleTimer);
  }
  sessionStatusTimer = null;
  idleTimer = null;
  stopActivityTracking();
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

function applyRefresh(answer: SessionMessage & { type: 'refresh' }): void {
  sessionStatusGeneration += 1;
  useAuthStore.getState().setSession(answer.accessToken, answer.expiresAt, answer.user);
  useAuthStore.setState({
    sessionExpiresAt: answer.sessionExpiresAt,
    sessionAbsoluteExpiresAt: answer.sessionAbsoluteExpiresAt,
  });
  startSessionStatusPolling();
  applySessionCutoff(answer.sessionExpiresAt);
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
    if (
      !answer.accessToken ||
      !answer.user?.id ||
      !Number.isFinite(answer.expiresIn) ||
      typeof answer.sessionExpiresAt !== 'string' ||
      !Number.isFinite(Date.parse(answer.sessionExpiresAt))
    ) {
      throw new Error('The sign in service returned an invalid session.');
    }
    const message: SessionMessage = {
      type: 'refresh',
      accessToken: answer.accessToken,
      expiresAt: Date.now() + answer.expiresIn * 1000,
      sessionExpiresAt: answer.sessionExpiresAt,
      sessionAbsoluteExpiresAt: answer.sessionAbsoluteExpiresAt ?? null,
      user: asUser(answer.user),
    };
    applyRefresh(message);
    channel?.postMessage(message);
    return message.accessToken;
  } catch (error) {
    console.warn('[Session] Could not refresh the VMMS session.', error);
    useAuthStore.setState({ status: 'unavailable' });
    return null;
  }
}

/** Refreshes under a same-origin lock so tabs never rotate the cookie concurrently. */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const tokenAtStart = useAuthStore.getState().token;
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  const work = () => {
    const current = useAuthStore.getState();
    if (
      current.token &&
      current.token !== tokenAtStart &&
      current.expiresAt !== null &&
      current.expiresAt - Date.now() > 60_000
    ) {
      return Promise.resolve(current.token);
    }
    return refreshRequest();
  };
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

export async function signOut(): Promise<'ok' | 'failed'> {
  if (leaving) return 'ok';
  const token = useAuthStore.getState().token;
  try {
    const response = await fetch(apiUrl('/vmms/session/logout'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: '{}',
    });
    if (response.status === 401) {
      handleSessionEnded('logout');
      return 'ok';
    }
    if (!response.ok) {
      console.error(`[Session] Logout returned HTTP ${response.status}.`);
      return 'failed';
    }
    handleSessionEnded('logout');
    return 'ok';
  } catch (error) {
    console.warn('[Session] Could not complete logout.', error);
    return 'failed';
  }
}

export function handleSessionEnded(reason: SessionEndReason = 'idle', notifyTabs = true): void {
  if (leaving) return;
  leaving = true;
  if (notifyTabs) channel?.postMessage({ type: 'ended', reason } satisfies SessionMessage);
  stopSessionStatusPolling();
  useAuthStore.getState().clearAuth();
  window.location.assign(`${PORTAL_URL}/login?reason=${reason}`);
}

export function keepWorking(): void {
  const warning = useAuthStore.getState().idleWarning;
  if (warning?.cannotExtend) {
    useAuthStore.setState({ idleWarning: { ...warning, dismissed: true } });
  }
}

export async function staySignedIn(): Promise<'extended' | 'ended' | 'unavailable'> {
  const warning = useAuthStore.getState().idleWarning;
  if (!warning || warning.busy) return 'unavailable';
  const endReason = warning.cannotExtend ? 'maxage' : 'idle';
  useAuthStore.setState({ idleWarning: { ...warning, busy: true } });

  const ping = await sendActivity();
  if (ping === 'ended') {
    handleSessionEnded(endReason);
    return 'ended';
  }
  if (ping === 'unavailable') {
    useAuthStore.setState({ idleWarning: { ...warning, busy: false } });
    return 'unavailable';
  }

  const generation = sessionStatusGeneration;
  const result = await fetchSessionStatus();
  if (generation !== sessionStatusGeneration) {
    const current = useAuthStore.getState();
    if (!current.authenticated) return 'ended';
    return current.idleWarning && !current.idleWarning.cannotExtend ? 'unavailable' : 'extended';
  }
  if (result.kind === 'ended') {
    handleSessionEnded(endReason);
    return 'ended';
  }
  if (result.kind === 'unavailable') {
    useAuthStore.setState({ idleWarning: { ...warning, busy: false } });
    return 'unavailable';
  }

  applySessionCutoff(result.sessionExpiresAt);
  const current = useAuthStore.getState();
  if (!current.authenticated) return 'ended';
  return current.idleWarning && !current.idleWarning.cannotExtend ? 'unavailable' : 'extended';
}

channel?.addEventListener('message', (event: MessageEvent<SessionMessage>) => {
  const message = event.data;
  if (message?.type === 'refresh') applyRefresh(message);
  else if (message?.type === 'extended') void checkSessionStatus();
  else if (message?.type === 'ended') handleSessionEnded(message.reason, false);
});

