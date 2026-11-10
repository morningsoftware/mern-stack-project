export interface ApiError extends Error {
  status?: number;
}

const CSRF_COOKIE = "mern_csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

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
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

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
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    const error = new Error(data.error || "Request failed") as ApiError;
    error.status = response.status;
    throw error;
  }
  return data as T;
}

export async function screenshotBlob(
  path: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(path, {
    signal,
    credentials: "include",
  });
  if (!response.ok) throw new Error("Screenshot could not be loaded.");
  return response.blob();
}
