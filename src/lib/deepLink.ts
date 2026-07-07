/**
 * Deep-link validation — spec §10.9.
 * Validates devinx://session/{id} URLs: ID must match devin- prefix + UUID format.
 * Requires auth — unauthenticated deep links redirect to onboarding.
 */

import { branding } from '@lib/branding';

/**
 * Devin session ID: devin- prefix + URL-safe suffix. Real IDs come in more
 * than one shape (32-hex, dashed UUIDs, older formats) — requiring exactly
 * 32 hex chars rejected legitimate sessions returned by the API. The point
 * of this check is path-segment safety (no /, ?, #, .), not format policing.
 */
const SESSION_ID_RE = /^devin-[A-Za-z0-9_-]{6,64}$/;

export interface ParsedDeepLink {
  valid: boolean;
  screen?: 'session';
  sessionId?: string;
  reason?: string;
}

export function parseDeepLink(url: string): ParsedDeepLink {
  if (!url.startsWith(branding.linkPrefix)) {
    return { valid: false, reason: 'Wrong scheme' };
  }
  // Strip query string and fragment — devinx://session/<id>?src=push is a
  // legitimate link and must not glue "?src=push" onto the session ID.
  const path = url.slice(branding.linkPrefix.length).split(/[?#]/)[0] ?? '';
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) {
    // Bare devinx:// — valid, goes to board.
    return { valid: true };
  }

  if (parts[0] === 'session' && parts.length === 2 && parts[1]) {
    const id = parts[1];
    if (!SESSION_ID_RE.test(id)) {
      return { valid: false, reason: 'Invalid session ID format' };
    }
    return { valid: true, screen: 'session', sessionId: id };
  }

  return { valid: false, reason: 'Unknown route' };
}

/** Validates a session ID string (used by the session detail screen too). */
export function isValidSessionId(id: string): boolean {
  return SESSION_ID_RE.test(id);
}
