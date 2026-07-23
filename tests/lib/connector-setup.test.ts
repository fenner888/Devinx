import {
  CONNECTOR_RELEASE_PAGE,
  CONNECTOR_SETUP_PROMPT,
  WINDOWS_CONNECTOR_STORE_PAGE,
} from '../../src/lib/connectorSetup';

describe('Connector assisted setup', () => {
  it('uses only the official guarded release path', () => {
    expect(CONNECTOR_RELEASE_PAGE).toBe('https://github.com/fenner888/Devinx/releases/latest');
    expect(CONNECTOR_SETUP_PROMPT).toContain(CONNECTOR_RELEASE_PAGE);
    expect(WINDOWS_CONNECTOR_STORE_PAGE).toBe(
      'https://apps.microsoft.com/detail/9N52Z3FVMFH8',
    );
    expect(CONNECTOR_SETUP_PROMPT).toContain(WINDOWS_CONNECTOR_STORE_PAGE);
    expect(CONNECTOR_SETUP_PROMPT).toContain('Developer ID Application');
    expect(CONNECTOR_SETUP_PROMPT).toContain('notarization');
    expect(CONNECTOR_SETUP_PROMPT).toContain('DevinXTools.DevinXConnector');
    expect(CONNECTOR_SETUP_PROMPT).toContain(
      'CN=43D84E24-857C-4C40-9DAA-1A6983913CD9',
    );
    expect(CONNECTOR_SETUP_PROMPT).toContain(
      'DevinXTools.DevinXConnector_ydtgrt4yd5wrc',
    );
    expect(CONNECTOR_SETUP_PROMPT).toContain('Microsoft Store package');
    expect(CONNECTOR_SETUP_PROMPT).toContain('unsigned CI');
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
