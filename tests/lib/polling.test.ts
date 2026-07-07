/**
 * Polling policy tests (§8.4 / ADR-003).
 */

import { pollingPolicy, backoffDelay } from '../../src/lib/polling';

describe('pollingPolicy (§8.4)', () => {
  it('never polls terminal statuses', () => {
    expect(pollingPolicy('exit', 'active', 'session_detail')).toBe(false);
    expect(pollingPolicy('error', 'active', 'board')).toBe(false);
  });

  it('never polls in background', () => {
    expect(pollingPolicy('running', 'background', 'session_detail')).toBe(false);
  });

  it('polls a watched running session every 5s', () => {
    expect(pollingPolicy('running', 'active', 'session_detail')).toBe(5_000);
  });

  it('polls the board every 15s', () => {
    expect(pollingPolicy(undefined, 'active', 'board')).toBe(15_000);
  });

  it('does not poll other screens by default', () => {
    expect(pollingPolicy(undefined, 'active', 'other')).toBe(false);
  });
});

describe('backoffDelay (§8.4)', () => {
  it('honors Retry-After when provided', () => {
    const d = backoffDelay(1, 5000);
    expect(d).toBeGreaterThanOrEqual(5000);
    expect(d).toBeLessThan(5500);
  });

  it('uses exponential base with jitter', () => {
    const d = backoffDelay(2);
    expect(d).toBeGreaterThanOrEqual(4000);
    expect(d).toBeLessThan(5000);
  });

  it('caps the base at 60s', () => {
    const d = backoffDelay(10);
    expect(d).toBeLessThanOrEqual(61000);
  });
});
