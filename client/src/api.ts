const TOKEN_KEY = "mern_token";

export interface ApiError extends Error {
  status?: number;
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null as T;
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed") as ApiError;
    error.status = response.status;
    throw error;
  }
  return data as T;
}
