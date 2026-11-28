

const REQUEST_TIMEOUT_MS = 20_000;

const API_ERROR_MESSAGE =
  'Something went wrong. Please try again.';

const SERVER_ERROR_MESSAGE =
  'Something went wrong on our end. Please try again in a moment.';

const NETWORK_ERROR_MESSAGE =
  'Could not reach checkpoint. Check your internet connection and try again.';

const TIMEOUT_ERROR_MESSAGE =
  'This is taking too long. Check your internet connection and try again.';

/**
 * Represents an unsuccessful HTTP response.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Validates and normalizes the API server origin.
 *
 * Only the origin is accepted, not a complete API endpoint.
 *
 * HTTPS is required outside local development.
 * HTTP is permitted for local development and emulator addresses.
 */
export function validateOrigin(
  value: string,
  development = false
): string {
  const url = new URL(value.trim());

  const hasExtraUrlParts =
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    !['', '/'].includes(url.pathname);

  if (hasExtraUrlParts) {
    throw new Error(
      'Use the API origin only, without a path, credentials, query or fragment.'
    );
  }

  const localHosts = [
    'localhost',
    '127.0.0.1',
    '[::1]',
    '10.0.2.2',
  ];

  const isLocalHost = localHosts.includes(url.hostname);

  const allowsHttp = development || isLocalHost;

  if (
    url.protocol !== 'https:' &&
    !(allowsHttp && url.protocol === 'http:')
  ) {
    throw new Error(
      'The API must use HTTPS. HTTP is allowed only for local development.'
    );
  }

  return url.origin;
}

/**
 * Ensures that requests can only target paths belonging
 * to this application's API.
 */
function validateApiPath(path: string, origin: string): void {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/api/') ||
    path.startsWith('//') ||
    path.includes('\\')
  ) {
    throw new Error('Use a relative API path.');
  }

  try {
    const url = new URL(path, origin);

    if (
      url.origin !== origin ||
      !url.pathname.startsWith('/api/') ||
      url.hash
    ) {
      throw new Error('Use a relative API path.');
    }
  } catch {
    throw new Error('Use a relative API path.');
  }
}

/**
 * Reusable client for making authenticated API requests.
 *
 * Uses the default React Native fetch implementation.
 * A custom transport can still be injected for testing.
 */
export class ApiClient {
  private token: string | null = null;

  /** Called when the current authenticated session receives a 401. */
  onUnauthorized: (() => void) | null = null;

  readonly origin: string;

  private transport: typeof fetch;

  constructor(
    origin: string,
    transport: typeof fetch = fetch
  ) {
    this.origin = origin;
    this.transport = transport;
  }

  /**
   * Updates the authentication token used by future requests.
   */
  setToken(value: string | null): void {
    this.token = value;
  }

  /**
   * Creates an absolute API URL.
   */
  url(path: string): string {
    validateApiPath(path, this.origin);
    return this.origin + path;
  }

  /**
   * Returns the current authentication header, if available.
   */
  authHeaders(): Record<string, string> {
    return this.token
      ? { Authorization: `Bearer ${this.token}` }
      : {};
  }

  /**
   * Sends an HTTP request and returns its parsed response.
   */
  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    validateApiPath(path, this.origin);

    const requestUrl = this.origin + path;

    // Capture the token used for this specific request.
    const requestToken = this.token;

    const headers = new Headers(options.headers);

    if (requestToken) {
      headers.set(
        'Authorization',
        `Bearer ${requestToken}`
      );
    }

    // Automatically identify JSON string bodies.
    // Binary bodies retain their explicitly supplied content type.
    if (
      typeof options.body === 'string' &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    const externalSignal = options.signal;

    const handleExternalAbort = () => {
      controller.abort();
    };

    externalSignal?.addEventListener(
      'abort',
      handleExternalAbort,
      { once: true }
    );

    if (externalSignal?.aborted) {
      controller.abort();
    }

    try {
      // Diagnostic logging: does not expose tokens or request bodies.
      console.log(
        '[API request] Starting:',
        options.method || 'GET',
        requestUrl
      );

      const response = await this.transport.call(
        globalThis,
        requestUrl,
        {
          ...options,
          headers,
          signal: controller.signal,
        }
      );

      console.log(
        '[API request] Response received:',
        response.status,
        requestUrl
      );

      return await this.handleResponse<T>(
        response,
        requestToken
      );
    } catch (error) {
      // Preserve API errors so callers can inspect their HTTP status.
      if (error instanceof ApiError) {
        throw error;
      }

      // Preserve intentional cancellation.
      if (externalSignal?.aborted) {
        throw error;
      }

      // Distinguish timeout from a connection failure.
      if (controller.signal.aborted) {
        console.warn(
          '[API request] Request timed out:',
          requestUrl
        );

        throw new Error(TIMEOUT_ERROR_MESSAGE);
      }

      console.warn(
        '[API request] Network failure:',
        requestUrl,
        error
      );

      throw new Error(NETWORK_ERROR_MESSAGE);
    } finally {
      clearTimeout(timeout);

      externalSignal?.removeEventListener(
        'abort',
        handleExternalAbort
      );
    }
  }

  /**
   * Processes an HTTP response.
   */
  private async handleResponse<T>(
    response: Response,
    requestToken: string | null
  ): Promise<T> {
    // HTTP 204 means success without a response body.
    if (response.status === 204) {
      return null as T;
    }

    // The API is expected to return JSON for other responses.
    const data: unknown = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      // Only invalidate the session if this request used
      // the token that is still currently active.
      if (
        response.status === 401 &&
        requestToken &&
        requestToken === this.token
      ) {
        this.onUnauthorized?.();
      }

      const message =
        typeof data === 'object' &&
        data !== null &&
        'error' in data &&
        typeof data.error === 'string'
          ? data.error
          : API_ERROR_MESSAGE;

      throw new ApiError(message, response.status);
    }

    // Prevent an unexpected HTML or empty response from
    // being treated as a successful API operation.
    if (data === null) {
      throw new ApiError(
        SERVER_ERROR_MESSAGE,
        502
      );
    }

    return data as T;
  }
}
