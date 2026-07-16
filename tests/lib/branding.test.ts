/**
 * Branding tests (§1.4) — all name/scheme strings live here and nowhere else.
 */

import { branding } from '../../src/lib/branding';

describe('branding (§1.4)', () => {
  it('exposes the product name', () => {
    expect(branding.name).toBe('DevinX');
  });

  it('has the unofficial-client disclaimer', () => {
    expect(branding.subtitle).toContain('Unofficial');
    expect(branding.subtitle.length).toBeLessThanOrEqual(30);
    expect(branding.disclaimer).toContain('independent');
    expect(branding.disclaimer).toContain('Not affiliated with');
    expect(branding.disclaimer).toContain('Cognition AI');
  });

  it('has the devinx:// deep link scheme', () => {
    expect(branding.scheme).toBe('devinx');
    expect(branding.linkPrefix).toBe('devinx://');
  });

  it('recognizes both server-issued organization ID forms', () => {
    expect(branding.orgIdPrefix).toBe('org-');
    expect(branding.orgIdPrefixes).toEqual(['org-', 'org_']);
  });

  it('has fallback names for Apple rejection', () => {
    expect(branding.fallbackNames).toContain('Cockpit');
    expect(branding.fallbackNames).toContain('Dispatch');
    expect(branding.fallbackNames).toContain('Overwatch');
  });

  it('keychain keys match spec §9 exactly', () => {
    expect(branding.keychain.apiKey).toBe('devin_api_key');
    expect(branding.keychain.orgId).toBe('devin_org_id');
    expect(branding.keychain.attributionUserId).toBe('attribution_user_id');
    expect(branding.keychain.authKind).toBe('auth_kind');
  });
});
