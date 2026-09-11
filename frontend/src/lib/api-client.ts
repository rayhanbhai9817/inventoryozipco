/**
 * The single place the frontend talks to the Laravel API.
 *
 * No component calls `fetch` directly. Everything goes through here so that
 * authentication, error translation and the demo-mode switch live in one file.
 */

import type { ApiErrorBody } from '@/types/api';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'
).replace(/\/$/, '');

/**
 * When true, the UI renders from bundled demo data instead of calling the API.
 * This exists so the interface can be built and reviewed before a database is
 * connected; it must be false in production.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const TOKEN_STORAGE_KEY = 'fastsold.token';

/**
 * A failed request, carrying everything the UI needs to respond well: a message
 * safe to show a user, per-field validation errors for inline display, and the
 * status so callers can branch on 401 / 403 / 422.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly fieldErrors: Record<string, string[]> = {},
    readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The first error for a field, ready to drop into an input's error slot. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }

  get isInsufficientStock(): boolean {
    return this.code === 'insufficient_stock';
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/* -------------------------------------------------------------------------- */
/* Token storage                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The bearer token lives in `localStorage`.
 *
 * A deliberate trade-off: the API is token-authenticated across origins, which
 * rules out an httpOnly cookie without also adding a same-site proxy. Tokens are
 * short-lived (12 hours, or 30 days with "remember me"), are revoked on sign-out,
 * on password change and on deactivation, and the app sets a strict
 * Content-Security-Policy to limit script injection in the first place.
 */
export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  set(token: string): void {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Private browsing or blocked storage: the session simply won't persist
      // across reloads, which is preferable to a hard failure.
    }
  },

  clear(): void {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

/* -------------------------------------------------------------------------- */
/* Unauthenticated handling                                                   */
/* -------------------------------------------------------------------------- */

type UnauthenticatedHandler = () => void;

let onUnauthenticated: UnauthenticatedHandler | null = null;

/**
 * Registered by the auth provider so that a 401 anywhere in the app clears the
 * session and redirects once, rather than each screen handling it separately.
 */
export function setUnauthenticatedHandler(handler: UnauthenticatedHandler | null): void {
  onUnauthenticated = handler;
}

/* -------------------------------------------------------------------------- */
/* Request                                                                    */
/* -------------------------------------------------------------------------- */

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON body. Use `formData` instead when uploading a file. */
  body?: unknown;
  formData?: FormData;
  /** Query parameters, appended after empty values are dropped. */
  query?: Record<string, unknown>;
  /** Skip the Authorization header (login, register). */
  anonymous?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, formData, query, anonymous, headers, ...init } = options;

  const url = new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
  }

  const requestHeaders = new Headers({ Accept: 'application/json', ...(headers as HeadersInit) });

  if (!anonymous) {
    const token = tokenStore.get();
    if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  let payload: BodyInit | undefined;

  if (formData) {
    // Let the browser set the multipart boundary.
    payload = formData;
  } else if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  let response: Response;

  try {
    response = await fetch(url.toString(), { ...init, headers: requestHeaders, body: payload });
  } catch {
    // Network failure, DNS, CORS, offline. Never surface the raw reason.
    throw new ApiError(
      'We could not reach the server. Check your connection and try again.',
      0,
      'network_error',
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;

  if (!response.ok) {
    const errorBody: ApiErrorBody = isJson
      ? await response.json().catch(() => ({ message: 'Something went wrong.' }))
      : { message: fallbackMessageFor(response.status) };

    if (response.status === 401 && !anonymous) {
      tokenStore.clear();
      onUnauthenticated?.();
    }

    throw new ApiError(
      errorBody.message || fallbackMessageFor(response.status),
      response.status,
      errorBody.error,
      errorBody.errors ?? {},
      errorBody.context ?? {},
    );
  }

  return isJson ? ((await response.json()) as T) : (undefined as T);
}

function fallbackMessageFor(status: number): string {
  switch (status) {
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to do that.';
    case 404:
      return 'We could not find what you were looking for.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return status >= 500
        ? 'Something went wrong on our side. Please try again.'
        : 'That request could not be completed.';
  }
}

/* -------------------------------------------------------------------------- */
/* Verb helpers                                                               */
/* -------------------------------------------------------------------------- */

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body' | 'formData'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),

  /** Multipart upload, for product images, avatars and logos. */
  upload: <T>(path: string, formData: FormData, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', formData }),

  /**
   * Download a CSV export. Returns a Blob plus the filename the API suggested,
   * so the caller can hand it to the browser.
   */
  async download(
    path: string,
    query?: Record<string, unknown>,
  ): Promise<{ blob: Blob; filename: string }> {
    const url = new URL(`${API_BASE_URL}${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
    }

    const token = tokenStore.get();
    const response = await fetch(url.toString(), {
      headers: token ? { Authorization: `Bearer ${token}`, Accept: 'text/csv' } : { Accept: 'text/csv' },
    });

    if (!response.ok) {
      throw new ApiError(fallbackMessageFor(response.status), response.status);
    }

    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/.exec(disposition);

    return {
      blob: await response.blob(),
      filename: match?.[1] ?? 'fastsold-export.csv',
    };
  },
};

export { API_BASE_URL };
