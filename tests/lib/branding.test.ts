/**
 * Branding tests (§1.4) — all name/scheme strings live here and nowhere else.
 */

import { branding } from '../../src/lib/branding';

describe('branding (§1.4)', () => {
  it('exposes the product name', () => {
    expect(branding.name).toBe('Otterin');
  });

  it('has the approved subtitle and independent-companion disclaimer', () => {
    expect(branding.subtitle).toBe('Local coding sessions, mobile');
    expect(branding.disclaimer).toBe(
      'Otterin is an independent, unofficial companion app for Devin for Terminal. Not affiliated with, endorsed by, or a product of Cognition AI.',
    );
  });

  it('has the devinx:// deep link scheme', () => {
    expect(branding.scheme).toBe('devinx');
    expect(branding.linkPrefix).toBe('devinx://');
  });

  it('retains legacy Cloud key names only for cleanup', () => {
    expect(branding.keychain.apiKey).toBe('devin_api_key');
    expect(branding.keychain.orgId).toBe('devin_org_id');
    expect(branding.keychain.attributionUserId).toBe('attribution_user_id');
    expect(branding.keychain.authKind).toBe('auth_kind');
  });
});
