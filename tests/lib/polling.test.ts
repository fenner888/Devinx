/**
 * Polling policy tests (§8.4 / ADR-003).
 */

import {
  pollingPolicy,
  backoffDelay,
  scalePolling,
  messagePollingInterval,
} from '../../src/lib/polling';

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

  it('polls all non-terminal session-detail statuses, gently for sleeping', () => {
    expect(pollingPolicy('new', 'active', 'session_detail')).toBe(5_000);
    expect(pollingPolicy('resuming', 'active', 'session_detail')).toBe(5_000);
    expect(pollingPolicy('suspended', 'active', 'session_detail')).toBe(30_000);
  });

  it('scales intervals by polling mode', () => {
    expect(scalePolling(10_000, 'battery_saver')).toBe(20_000);
    expect(scalePolling(10_000, 'fast')).toBe(5_000);
    expect(scalePolling(false, 'fast')).toBe(false);
    expect(pollingPolicy('running', 'active', 'session_detail', 'battery_saver')).toBe(10_000);
  });
});

describe('messagePollingInterval', () => {
  it('polls a suspended session quickly after sending a follow-up', () => {
    expect(
      messagePollingInterval({
        appState: 'active',
        followUpUntil: 120_000,
        now: 1_000,
        sessionStatus: 'suspended',
      }),
    ).toBe(1_000);
  });

  it('stops polling terminal or sleeping sessions without a pending follow-up', () => {
    expect(messagePollingInterval({ appState: 'active', sessionStatus: 'suspended' })).toBe(false);
    expect(messagePollingInterval({ appState: 'active', sessionStatus: 'exit' })).toBe(false);
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
