const API_BASE = resolveApiBaseUrl();
const ANALYTICS_API_BASE = resolveAnalyticsApiBaseUrl();
export const useBackend = API_BASE !== "" && API_BASE !== "undefined";
let refreshInFlight: Promise<string | null> | null = null;

function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  const normalized = String(raw ?? "")
    .trim()
    .replace(/\/+$/, "");
  return normalized === "undefined" ? "" : normalized;
}

function resolveAnalyticsApiBaseUrl(): string {
  const raw = import.meta.env.VITE_ANALYTICS_API_URL;
  if (!raw || raw === "undefined") {
    // Fall back to main backend if analytics service is not configured
    return API_BASE;
  }
  const normalized = String(raw)
    .trim()
    .replace(/\/+$/, "");
  return normalized;
}

const buildUrl = (path: string) => {
  const resolvedPath = path.startsWith("/") ? path : `/${path}`;

  if (!useBackend) {
    return resolvedPath;
  }

  // Route analytics calls to the standalone analytics microservice if configured
  if (ANALYTICS_API_BASE) {
    if (resolvedPath.startsWith("/vmms/analytics")) {
      const analyticsPath = resolvedPath.replace(/^\/vmms\/analytics/, "/analytics");
      return new URL(analyticsPath.replace(/^\/+/, ""), `${ANALYTICS_API_BASE}/`).toString();
    }

    if (resolvedPath.startsWith("/analytics")) {
      return new URL(resolvedPath.replace(/^\/+/, ""), `${ANALYTICS_API_BASE}/`).toString();
    }

    if (resolvedPath.startsWith("/workorders")) {
      return new URL(resolvedPath.replace(/^\/+/, ""), `${ANALYTICS_API_BASE}/`).toString();
    }

    if (resolvedPath.startsWith("/maintenance-schedules/search")) {
      return new URL(resolvedPath.replace(/^\/+/, ""), `${ANALYTICS_API_BASE}/`).toString();
    }

  }

  return new URL(path.replace(/^\/{1,}/, ""), `${API_BASE}/`).toString();
};

const defaultHeaders = {
  Accept: "application/json",
  "X-VMMS-Client": "web",
};

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function dispatchUnauthorizedEvent(status: number) {
  window.localStorage.removeItem("accessToken");
  window.dispatchEvent(
    new CustomEvent("unauthorized", { detail: { status } }),
  );
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { ...defaultHeaders },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const session = (await response.json()) as { accessToken?: unknown };
        if (typeof session.accessToken !== "string" || !session.accessToken) return null;
        window.localStorage.setItem("accessToken", session.accessToken);
        return session.accessToken;
      })
      .catch(() => null)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const token = window.localStorage.getItem("accessToken");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const restInit: RequestInit = { ...(init ?? {}) };
  // remove headers from the init object because we pass a merged headers object separately
  if ('headers' in restInit && restInit.headers !== undefined) {
    // `headers` is an optional property on `RequestInit` so deleting it is safe
    delete (restInit as RequestInit)['headers'];
  }

  const requestUrl = buildUrl(path);
  const credentials = useBackend && new URL(requestUrl).origin === new URL(API_BASE).origin
    ? "include"
    : "same-origin";
  const response = await fetch(requestUrl, {
    credentials,
    headers: {
      ...defaultHeaders,
      ...Object.fromEntries(headers.entries()),
    },
    ...restInit,
  });

  if (!response.ok) {
    const resolvedPath = path.startsWith("/") ? path : `/${path}`;
    if (
      response.status === 401 && allowRefresh &&
      resolvedPath !== "/auth/login" && resolvedPath !== "/auth/refresh"
    ) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) return apiRequest<T>(path, init, false);
    }
    // 403 means the session is valid but the user lacks permission for this
    // request. Only 401 should clear the token and trigger reauthentication.
    if (response.status === 401) {
      dispatchUnauthorizedEvent(response.status);
    }
    const responseText = await response.text().catch(() => "");
    let responseData: unknown = responseText;

    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      // Keep non-JSON responses as text.
    }

    const message =
      typeof responseData === "object" &&
      responseData !== null &&
      "message" in responseData &&
      typeof responseData.message === "string"
        ? responseData.message
        : responseText ||
          `Request failed ${response.status} ${response.statusText}`;

    throw new ApiError(message, response.status, responseData);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  if (/^(image\/|video\/|application\/pdf|application\/octet-stream|text\/plain)/i.test(contentType)) {
    return response.blob() as Promise<T>;
  }

  const responseText = await response.text();
  return responseText as T;
}

export async function fetchJSON<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const resolvedInit = { ...(init ?? {}) };

  let body = resolvedInit.body;
  const headers = new Headers(resolvedInit.headers ?? {});

  if (body && typeof body !== "string") {
    body = JSON.stringify(body);
  }

  if (body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return apiRequest<T>(path, {
    ...resolvedInit,
    body,
    headers,
  });
}
