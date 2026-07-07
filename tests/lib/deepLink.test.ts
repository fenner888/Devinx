/**
 * §10.9 gate test — deep-link validation.
 * devinx://session/{id} must validate ID format and require auth.
 */

import { parseDeepLink, isValidSessionId } from '../../src/lib/deepLink';

describe('deep-link validation (§10.9)', () => {
  it('accepts a valid session deep link', () => {
    const id = 'devin-0a4d31d638894ec2b9d64338be35eb3b';
    const result = parseDeepLink(`devinx://session/${id}`);
    expect(result.valid).toBe(true);
    expect(result.screen).toBe('session');
    expect(result.sessionId).toBe(id);
  });

  it('rejects a session ID without devin- prefix', () => {
    const result = parseDeepLink('devinx://session/0a4d31d638894ec2b9d64338be35eb3b');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid session ID');
  });

  it('rejects a session ID that is too short', () => {
    const result = parseDeepLink('devinx://session/devin-short');
    expect(result.valid).toBe(false);
  });

  it('rejects a non-session route', () => {
    const result = parseDeepLink('devinx://unknown/route');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unknown route');
  });

  it('rejects a wrong scheme', () => {
    const result = parseDeepLink('https://example.com/session/devin-0a4d31d638894ec2b9d64338be35eb3b');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Wrong scheme');
  });

  it('accepts a bare devinx:// link (goes to board)', () => {
    const result = parseDeepLink('devinx://');
    expect(result.valid).toBe(true);
    expect(result.screen).toBeUndefined();
  });

  it('isValidSessionId validates standalone IDs', () => {
    expect(isValidSessionId('devin-0a4d31d638894ec2b9d64338be35eb3b')).toBe(true);
    expect(isValidSessionId('devin-short')).toBe(false);
    expect(isValidSessionId('not-a-devin-id')).toBe(false);
    expect(isValidSessionId('')).toBe(false);
  });
});
