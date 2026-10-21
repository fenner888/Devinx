import { parseDeepLink } from '../../src/lib/deepLink';

describe('deep-link validation', () => {
  it('opens Home for the retained bare devinx:// scheme', () => {
    expect(parseDeepLink('devinx://').valid).toBe(true);
  });

  it('rejects the removed Cloud session route', () => {
    expect(parseDeepLink('devinx://session/legacy-id')).toEqual({
      valid: false,
      reason: 'Unknown route',
    });
  });

  it('rejects unknown routes and the wrong scheme', () => {
    expect(parseDeepLink('devinx://unknown/route').valid).toBe(false);
    expect(parseDeepLink('https://example.com').reason).toBe('Wrong scheme');
  });
});
