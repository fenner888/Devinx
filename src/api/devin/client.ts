/**
 * API client — fetch wrapper (spec §8.1, §8.4).
 * Injects auth headers, enforces 15s timeout, classifies errors, retries
 * 5xx/network with exponential backoff, hard-stops on 401.
 *
 * Components never import this. Hooks/queries do.
 */

import * as Sentry from '@sentry/react-native';
import type { AuthProvider } from '@auth/AuthProvider';
import { ApiSchemaError } from '@auth/AuthProvider';
import type { ZodTypeAny } from 'zod';

const DEFAULT_BASE_URL = 'https://api.devin.ai';
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: 'auth' | 'permission' | 'not_found' | 'rate_limited' | 'server' | 'network' | 'schema' | 'unknown',
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
  /** zod schema to parse the response. If omitted, raw JSON is returned. */
  schema?: ZodTypeAny;
  /** Override retry count for this request. */
  maxRetries?: number;
  /** Skip auth (e.g. for the validate call which builds its own headers). */
  skipAuth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL;
  const url = new URL(path.startsWith('http') ? path : `${base}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyError(status: number, retryAfter?: string | null): ApiError {
  const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
  switch (status) {
    case 401:
      return new ApiError('Authentication failed — key may be revoked or rotated', status, 'auth');
    case 403:
      return new ApiError('Permission denied — key lacks required scope', status, 'permission');
    case 404:
      return new ApiError('Not found', status, 'not_found');
    case 429:
      return new ApiError('Rate limited', status, 'rate_limited', retryAfterMs);
    default:
      if (status >= 500) return new ApiError(`Server error: ${status}`, status, 'server');
      return new ApiError(`Unexpected status: ${status}`, status, 'unknown');
  }
}

/**
 * Global 429 cooldown — when any request is rate-limited, all queries pause
 * until the cooldown expires (spec §8.4).
 */
let rateLimitCooldownUntil = 0;

export function isRateLimited(): boolean {
  return Date.now() < rateLimitCooldownUntil;
}

export function clearRateLimit(): void {
  rateLimitCooldownUntil = 0;
}

export async function apiRequest<T = unknown>(
  auth: AuthProvider,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, query, schema, maxRetries = MAX_RETRIES, skipAuth = false } = options;
  const url = buildUrl(path, query);

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check rate-limit cooldown before each attempt.
    if (isRateLimited() && attempt === 0) {
      const wait = rateLimitCooldownUntil - Date.now();
      if (wait > 0) await delay(wait);
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!skipAuth) {
        Object.assign(headers, await auth.authHeaders());
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // 401 — hard stop, no retry (spec §8.4).
      if (res.status === 401) {
        throw classifyError(401);
      }

      // 429 — set cooldown, retry with backoff.
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const err = classifyError(429, retryAfter);
        if (err.retryAfterMs) {
          rateLimitCooldownUntil = Date.now() + err.retryAfterMs;
        }
        lastError = err;
        if (attempt < maxRetries) {
          const backoff = err.retryAfterMs ?? Math.min(1000 * 2 ** attempt, 60_000);
          await delay(backoff + Math.floor(Math.random() * 500));
          continue;
        }
        throw err;
      }

      // 5xx — retry with backoff.
      if (res.status >= 500) {
        lastError = classifyError(res.status);
        if (attempt < maxRetries) {
          const backoff = Math.min(1000 * 2 ** attempt, 60_000);
          await delay(backoff + Math.floor(Math.random() * 500));
          continue;
        }
        throw lastError;
      }

      // 4xx (non-401/429) — no retry.
      if (!res.ok) {
        throw classifyError(res.status);
      }

      // Parse response.
      const json = await res.json();
      if (schema) {
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          const err = new ApiSchemaError(
            `Schema validation failed for ${path}`,
            path,
            parsed.error.issues,
          );
          Sentry.captureException(err);
          throw err;
        }
        return parsed.data as T;
      }
      return json as T;
    } catch (e) {
      if (e instanceof ApiError || e instanceof ApiSchemaError) throw e;

      const msg = e instanceof Error ? e.message : String(e);
      if (/timeout|abort|network|fetch/i.test(msg)) {
        lastError = new ApiError(`Network error: ${msg}`, 0, 'network');
        if (attempt < maxRetries) {
          const backoff = Math.min(1000 * 2 ** attempt, 60_000);
          await delay(backoff + Math.floor(Math.random() * 500));
          continue;
        }
        throw lastError;
      }
      Sentry.captureException(e);
      throw e;
    }
  }

  throw lastError ?? new ApiError('Exhausted retries', 0, 'network');
}
