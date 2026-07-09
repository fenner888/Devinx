#!/usr/bin/env node
/**
 * DevinX push notifier — optional, self-hostable.
 *
 * The Devin API has no push mechanism, and iOS won't let the app poll in the
 * background. This tiny service polls the Devin sessions API on an interval,
 * detects sessions that transition into a "needs your input" state (or finish),
 * and sends an Expo push notification to the device tokens it knows about.
 *
 * Run it anywhere Node runs (a cheap VM, a Raspberry Pi, a cron box). It's the
 * server half of push notifications — everyone who wants pushes runs this;
 * everyone else loses nothing (the app works fully without it).
 *
 * Env:
 *   DEVIN_API_KEY   cog_ service-user key (read-only session access is enough)
 *   DEVIN_ORG_ID    org-... id
 *   EXPO_PUSH_TOKENS  comma-separated ExponentPushToken[...] values to notify
 *   POLL_SECONDS    interval (default 60)
 *
 * The app registers a device token via getPushToken(); persist those tokens
 * wherever you like (a file, a KV store) and feed them in via EXPO_PUSH_TOKENS.
 */

const API = process.env.DEVIN_API_BASE || 'https://api.devin.ai';
const KEY = process.env.DEVIN_API_KEY;
const ORG = process.env.DEVIN_ORG_ID;
const TOKENS = (process.env.EXPO_PUSH_TOKENS || '').split(',').map((t) => t.trim()).filter(Boolean);
const POLL_MS = (Number(process.env.POLL_SECONDS) || 60) * 1000;

if (!KEY || !ORG) {
  console.error('Set DEVIN_API_KEY and DEVIN_ORG_ID.');
  process.exit(1);
}
if (TOKENS.length === 0) {
  console.warn('No EXPO_PUSH_TOKENS set — nothing to notify. Add device tokens to enable pushes.');
}

/** status_detail values that mean a session is waiting on the user. */
const NEEDS_INPUT = new Set(['waiting_for_user', 'waiting_for_approval']);
const lastState = new Map(); // session_id -> status_detail|status

async function listSessions() {
  const res = await fetch(`${API}/v3/organizations/${ORG}/sessions?first=100`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`sessions ${res.status}`);
  const data = await res.json();
  return data.items ?? [];
}

async function push(title, body, sessionId) {
  if (TOKENS.length === 0) return;
  const messages = TOKENS.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    data: { sessionId },
  }));
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  }).catch((e) => console.error('push failed', e.message));
}

async function tick() {
  try {
    const sessions = await listSessions();
    for (const s of sessions) {
      const prev = lastState.get(s.session_id);
      const detail = s.status_detail ?? s.status;
      // Fire when a session newly needs input, or newly finished.
      if (detail !== prev) {
        if (NEEDS_INPUT.has(detail) && !NEEDS_INPUT.has(prev)) {
          await push('Devin needs your input', s.title || 'A session is waiting for you', s.session_id);
        } else if (s.status === 'exit' && prev && prev !== 'exit') {
          await push('Devin finished', s.title || 'A session completed', s.session_id);
        }
        lastState.set(s.session_id, detail);
      }
    }
    console.log(`[${new Date().toISOString()}] checked ${sessions.length} sessions`);
  } catch (e) {
    console.error('tick error', e.message);
  }
}

console.log(`DevinX notifier: polling every ${POLL_MS / 1000}s, ${TOKENS.length} device(s).`);
tick();
setInterval(tick, POLL_MS);
