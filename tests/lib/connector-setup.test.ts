import { CONNECTOR_RELEASE_PAGE, CONNECTOR_SETUP_PROMPT } from '../../src/lib/connectorSetup';

describe('Connector assisted setup', () => {
  it('uses only the official guarded release path', () => {
    expect(CONNECTOR_RELEASE_PAGE).toBe('https://github.com/fenner888/Devinx/releases/latest');
    expect(CONNECTOR_SETUP_PROMPT).toContain(CONNECTOR_RELEASE_PAGE);
    expect(CONNECTOR_SETUP_PROMPT).toContain('Developer ID Application');
    expect(CONNECTOR_SETUP_PROMPT).toContain('notarized');
    expect(CONNECTOR_SETUP_PROMPT).toContain('Authenticode');
    expect(CONNECTOR_SETUP_PROMPT).toContain('signed per-user package');
    expect(CONNECTOR_SETUP_PROMPT).toContain('unsigned CI artifact');
    expect(CONNECTOR_SETUP_PROMPT).toContain('SHA-256');
    expect(CONNECTOR_SETUP_PROMPT).toContain('stop and tell me');
    expect(CONNECTOR_SETUP_PROMPT).toContain('Do not clone or build the source');
    expect(CONNECTOR_SETUP_PROMPT).toContain(
      'Tailscale supplies only the private network route',
    );
    expect(CONNECTOR_SETUP_PROMPT).toContain('Cloud-only DevinX use does not require Connector');
    expect(CONNECTOR_SETUP_PROMPT).toContain(
      'A Tailscale IP, server URL, or password cannot replace a compatible service',
    );
    expect(CONNECTOR_SETUP_PROMPT).not.toContain('OFFICIAL_CONNECTOR_DMG_URL');
    expect(CONNECTOR_SETUP_PROMPT).toContain('Do not run it as root or Administrator');
    expect(CONNECTOR_SETUP_PROMPT).toContain('bind it to 0.0.0.0');
  });
});
