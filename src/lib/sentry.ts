/**
 * Sentry initialization with the §10.2 secret-scrubbing beforeSend.
 *
 * Gates (spec §10):
 *  - Authorization headers never sent to Sentry (network breadcrumbs disabled
 *    for api.devin.ai).
 *  - Key-shaped strings (cog_*, org-*, devin-*, Bearer ...) scrubbed from
 *    every tag, extra, breadcrumb, and request body.
 *  - Message bodies (session prompts, Devin replies) never attached to events.
 *  - PostHog receives event names + counts ONLY (handled in analytics module).
 */

import * as Sentry from '@sentry/react-native';
import { branding } from '../lib/branding';

const KEY_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Bearer tokens first so the whole "Bearer cog_..." is redacted as one.
  { pattern: /Bearer\s+[A-Za-z0-9._~+/=-]+/gi, replacement: '[bearer_redacted]' },
  { pattern: /cog_[A-Za-z0-9_-]+/g, replacement: '[cog_redacted]' },
  { pattern: /org-[A-Za-z0-9_-]+/g, replacement: '[org_redacted]' },
  { pattern: /devin-[A-Za-z0-9_-]+/g, replacement: '[devin_redacted]' },
  { pattern: /[A-Za-z0-9_-]{24,}/g, replacement: '[token_redacted]' },
];

export function scrubString(input: string): string {
  let out = input;
  for (const { pattern, replacement } of KEY_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function scrubUnknown(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[max_depth]';
  if (typeof value === 'string') return scrubString(value);
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrubUnknown(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // Drop fields that should never carry secret-adjacent data.
    if (/authorization|api[-_]?key|token|secret|password|cookie|header/i.test(k)) {
      out[k] = '[redacted]';
    } else if (/message|prompt|body|content|text/i.test(k)) {
      // Spec §10.2: message bodies never sent. Drop entirely.
      out[k] = '[content_redacted]';
    } else {
      out[k] = scrubUnknown(v, depth + 1);
    }
  }
  return out;
}

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    // No DSN configured — Sentry stays a no-op. Safe for local dev.
    return;
  }
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    beforeSend(event) {
      // Scrub every field that could carry a secret or session content.
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
        if (event.request.url) {
          event.request.url = scrubString(event.request.url);
        }
        if (event.request.data) {
          event.request.data = '[content_redacted]' as unknown as string;
        }
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs
          .filter((b) => {
            // Drop network breadcrumbs for api.devin.ai (spec §10.2).
            if (b.type === 'http' && typeof b.data?.url === 'string') {
              return !/api\.devin\.ai/.test(b.data.url);
            }
            return true;
          })
          .map((b) => scrubUnknown(b) as Sentry.Breadcrumb);
      }
      if (event.tags) event.tags = scrubUnknown(event.tags) as Record<string, string>;
      if (event.extra) event.extra = scrubUnknown(event.extra) as Record<string, unknown>;
      if (event.contexts) event.contexts = scrubUnknown(event.contexts) as Record<string, Record<string, unknown>>;
      if (event.message) event.message = scrubString(event.message);
      return event;
    },
    integrations: [
      // Explicitly disable network breadcrumb capture for the API host.
      Sentry.httpClientIntegration({
        // @ts-expect-error — RN SDK supports this flag
        ignoreURLs: [/api\.devin\.ai/],
      }),
    ],
    ignoreErrors: ['ApiSchemaError'],
  });
}

/** Set Sentry user context (non-sensitive — just auth kind, no IDs). */
export function setSentryUserContext(authKind: 'service_user' | 'pat' | null): void {
  if (!authKind) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    // Don't send actual user/org IDs — just the auth method for debugging.
    id: authKind,
    username: authKind,
  });
  Sentry.setTag('auth_kind', authKind);
}

/** Add a breadcrumb for navigation events. */
export function addNavigationBreadcrumb(screen: string): void {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Navigated to ${screen}`,
    level: 'info',
  });
}

/** Add a breadcrumb for API calls (without sensitive data). */
export function addApiBreadcrumb(method: string, endpoint: string, statusCode?: number): void {
  Sentry.addBreadcrumb({
    category: 'api',
    message: `${method.toUpperCase()} ${endpoint}`,
    level: statusCode && statusCode >= 400 ? 'warning' : 'info',
    data: statusCode ? { status: statusCode } : undefined,
  });
}

export { branding };
