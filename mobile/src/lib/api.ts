export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export function validateOrigin(value: string, development = false): string {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname))
    throw new Error('Use the API origin only, without a path, credentials, query or fragment.');
  const local = ['localhost', '127.0.0.1', '[::1]', '10.0.2.2'].includes(url.hostname);
  if (url.protocol !== 'https:' && !((development || local) && url.protocol === 'http:'))
    throw new Error('The API must use HTTPS. HTTP is allowed only for local development.');
  return url.origin;
}

export class ApiClient {
  private token: string | null = null;
  onUnauthorized: (() => void) | null = null;
  readonly origin: string;
  private transport: typeof fetch;
  constructor(origin: string, transport: typeof fetch = fetch) { this.origin = origin; this.transport = transport; }
  setToken(value: string | null) { this.token = value; }
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!path.startsWith('/api/') || path.includes('://')) throw new Error('Use a relative API path.');
    const token = this.token;
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (typeof options.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) controller.abort();
    let response: Response;
    try {
      response = await this.transport.call(globalThis, this.origin + path, { ...options, headers, signal: controller.signal });
      if (response.status === 204) return null as T;
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401 && token && token === this.token) this.onUnauthorized?.();
        throw new ApiError(data?.error || `Request failed (${response.status}).`, response.status);
      }
      if (data === null) throw new ApiError('The server did not return JSON. Check the API address and try again.', 502);
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (options.signal?.aborted) throw error;
      throw new Error(controller.signal.aborted ? 'The request timed out. Check your connection and try again.' : 'Could not reach checkpoint. Check your connection and API address.');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }
}
