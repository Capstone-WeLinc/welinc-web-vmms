const API_BASE = resolveApiBaseUrl();
export const useBackend = API_BASE !== "" && API_BASE !== "undefined";

function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  const normalized = String(raw ?? "")
    .trim()
    .replace(/\/+$/, "");
  return normalized === "undefined" ? "" : normalized;
}

const buildUrl = (path: string) => {
  const resolvedPath = path.startsWith("/") ? path : `/${path}`;

  if (!useBackend) {
    return resolvedPath;
  }

  return new URL(path.replace(/^\/+/, ""), `${API_BASE}/`).toString();
};

const defaultHeaders = {
  Accept: "application/json",
};

function dispatchUnauthorizedEvent(status: number) {
  window.localStorage.removeItem("accessToken");
  window.dispatchEvent(
    new CustomEvent("unauthorized", { detail: { status } }),
  );
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
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

  const response = await fetch(buildUrl(path), {
    credentials: "include",
    headers: {
      ...defaultHeaders,
      ...Object.fromEntries(headers.entries()),
    },
    ...restInit,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      dispatchUnauthorizedEvent(response.status);
    }
    const responseText = await response.text().catch(() => "");
    throw new Error(
      responseText ||
        `Request failed ${response.status} ${response.statusText}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
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
