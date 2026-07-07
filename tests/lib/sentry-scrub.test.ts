/**
 * §10.2 gate test — Sentry beforeSend scrubs secrets and content.
 * Verifies the scrubber never lets a cog_ key, org ID, devin ID, Bearer
 * token, or message body through to Sentry.
 */

import { scrubString, scrubUnknown } from '../../src/lib/sentry';

describe('Sentry secret scrubber (§10.2 gate)', () => {
  it('redacts cog_ API keys', () => {
    expect(scrubString('Authorization: Bearer cog_abc123def456')).toBe(
      'Authorization: [bearer_redacted]',
    );
    expect(scrubString('key=cog_supersecret_value_here')).toBe(
      'key=[cog_redacted]',
    );
  });

  it('redacts org- and devin- IDs', () => {
    expect(scrubString('org-abc123def456789')).toBe('[org_redacted]');
    expect(scrubString('devin-xyz789abc123456')).toBe('[devin_redacted]');
  });

  it('redacts long token-shaped strings', () => {
    expect(scrubString('a'.repeat(30))).toBe('[token_redacted]');
  });

  it('leaves short normal strings intact', () => {
    expect(scrubString('Session board loaded')).toBe('Session board loaded');
  });

  it('scrubs nested objects and drops secret-adjacent keys', () => {
    const input = {
      request: {
        headers: { Authorization: 'Bearer cog_secret' },
        url: 'https://api.devin.ai/v3/organizations/org-123/sessions/devin-456',
      },
      tags: { session: 'devin-abc123', user: 'normal' },
      extra: { apiKey: 'cog_leaked', note: 'harmless' },
      breadcrumb: {
        message: 'Devin asked: should I migrate the enum?',
        level: 'info',
      },
    };
    const out = scrubUnknown(input) as Record<string, unknown>;
    const req = out.request as Record<string, unknown>;
    expect(req.headers).toBe('[redacted]');
    expect(String(req.url)).not.toContain('org-123');
    expect(String(req.url)).not.toContain('devin-456');
    const tags = out.tags as Record<string, unknown>;
    expect(String(tags.session)).toBe('[devin_redacted]');
    const extra = out.extra as Record<string, unknown>;
    expect(extra.apiKey).toBe('[redacted]');
    const crumb = out.breadcrumb as Record<string, unknown>;
    expect(crumb.message).toBe('[content_redacted]');
  });

  it('redacts message/prompt/body/content keys regardless of value', () => {
    const out = scrubUnknown({ message: 'hello', prompt: 'fix the bug' }) as Record<string, unknown>;
    expect(out.message).toBe('[content_redacted]');
    expect(out.prompt).toBe('[content_redacted]');
  });
});
