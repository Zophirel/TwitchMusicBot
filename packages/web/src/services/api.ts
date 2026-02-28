const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export type ApiOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  csrfToken?: string | null;
};

export function readCookie(name: string) {
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === name) {
      return value;
    }
  }
  return null;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}) {
  const url = `${API_BASE}${path}`;
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.csrfToken && method !== "GET") {
    headers["x-csrf-token"] = options.csrfToken;
  }

  const response = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
