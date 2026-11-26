import { useAuthStore } from '../../store/authStore';
import { handleSessionEnded, refreshAccessToken } from '../session/session';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '');
export const useBackend = API_BASE !== '' && API_BASE !== 'undefined';

function buildUrl(path: string): string {
  const route = path.startsWith('/') ? path : `/${path}`;
  if (!useBackend) return route;
  if (route.startsWith('/auth/')) return new URL(route.slice(1), `${API_BASE}/`).toString();
  if (route.startsWith('/vmms/')) return new URL(route.slice(1), `${API_BASE}/`).toString();
  if (route.startsWith('/analytics/')) {
    return new URL(`vmms${route}`, `${API_BASE}/`).toString();
  }
  if (route.startsWith('/workorders')) {
    return new URL(`vmms/analytics${route}`, `${API_BASE}/`).toString();
  }
  if (route.startsWith('/maintenance-schedules/search')) {
    return new URL(`vmms/analytics${route}`, `${API_BASE}/`).toString();
  }
  return new URL(`vmms${route}`, `${API_BASE}/`).toString();
}

const defaultHeaders = { Accept: 'application/json' };

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function readMessage(data: unknown, fallback: string): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return data.message;
  }
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const headers = new Headers(defaultHeaders);
  new Headers(init.headers ?? {}).forEach((value, name) => headers.set(name, value));
  const token = useAuthStore.getState().token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(buildUrl(path), {
    ...init,
    credentials: useBackend ? 'include' : 'same-origin',
    headers,
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    let data: unknown = responseText;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      // Keep a non-JSON response as text.
    }
    if (
      response.status === 403 &&
      typeof data === 'object' && data !== null &&
      'code' in data && data.code === 'ADMIN_CODE_REQUIRED'
    ) {
      window.dispatchEvent(new CustomEvent('admin-code-required'));
    }
    const route = path.startsWith('/') ? path : `/${path}`;
    const isSessionRoute = route.startsWith('/vmms/session/');
    if (response.status === 401 && allowRefresh && !isSessionRoute) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return apiRequest<T>(path, init, false);
      if (useAuthStore.getState().status !== 'unavailable') handleSessionEnded();
    }
    throw new ApiError(
      readMessage(data, responseText || `Request failed ${response.status} ${response.statusText}`),
      response.status,
      data,
    );
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json() as Promise<T>;
  if (/^(image\/|video\/|application\/pdf|application\/octet-stream|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|text\/plain)/i.test(contentType)) {
    return response.blob() as Promise<T>;
  }
  return (await response.text()) as T;
}

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const resolved = { ...(init ?? {}) };
  const headers = new Headers(resolved.headers ?? {});
  if (resolved.body && typeof resolved.body !== 'string') {
    resolved.body = JSON.stringify(resolved.body);
  }
  if (resolved.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return apiRequest<T>(path, { ...resolved, headers });
}
