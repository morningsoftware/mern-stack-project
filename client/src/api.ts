export interface ApiError extends Error {
  status?: number;
}

const CSRF_COOKIE = "mern_csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) {
      const encoded = value.slice(prefix.length);
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded;
      }
    }
  }
  return null;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const method = (options.method || "GET").toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });
  if (response.status === 204) return null as T;
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed") as ApiError;
    error.status = response.status;
    throw error;
  }
  return data as T;
}
