/**
 * Deep link parsing tests — spec §10.9.
 */

import { parseDeepLink, isValidSessionId } from '../../src/lib/deepLink';

describe('deepLink', () => {
  describe('parseDeepLink', () => {
    it('parses valid session deep link', () => {
      const result = parseDeepLink('devinx://session/devin-abc123def456789012345678901234ab');
      expect(result.valid).toBe(true);
      expect(result.screen).toBe('session');
      expect(result.sessionId).toBe('devin-abc123def456789012345678901234ab');
    });

    it('accepts bare devinx:// as valid (goes to board)', () => {
      const result = parseDeepLink('devinx://');
      expect(result.valid).toBe(true);
      expect(result.screen).toBeUndefined();
    });

    it('rejects wrong scheme', () => {
      const result = parseDeepLink('https://session/devin-abc123');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Wrong scheme');
    });

    it('rejects a path-unsafe session ID', () => {
      const result = parseDeepLink('devinx://session/bad$id{}');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid session ID format');
    });

    it('rejects unknown route', () => {
      const result = parseDeepLink('devinx://unknown/path');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Unknown route');
    });

    it('rejects session route without ID', () => {
      const result = parseDeepLink('devinx://session');
      expect(result.valid).toBe(false);
    });
  });

  describe('isValidSessionId', () => {
    it('accepts valid devin- ID', () => {
      expect(isValidSessionId('devin-abc123def456789012345678901234ab')).toBe(true);
    });

    // The v3 API returns session_id without the devin- prefix (the prefixed
    // form is devin_id, added by the API layer when building URL paths).
    it('accepts bare session IDs without the devin- prefix', () => {
      expect(isValidSessionId('abc123def456789012345678901234ab')).toBe(true);
    });

    it('rejects too-short ID', () => {
      expect(isValidSessionId('abc')).toBe(false);
    });

    // Real session IDs aren't hex-only (dashed UUIDs, older formats exist) —
    // the check enforces path-segment safety, not a hex format.
    it('accepts non-hex but URL-safe characters', () => {
      expect(isValidSessionId('devin-xyz123def456789012345678901234abcd')).toBe(true);
    });

    it('rejects path-unsafe characters', () => {
      expect(isValidSessionId('devin-abc123/../../etc')).toBe(false);
      expect(isValidSessionId('devin-abc123?q=1')).toBe(false);
    });
  });
});
