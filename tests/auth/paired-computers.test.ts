const mockSecureValues = new Map<string, string>();

jest.mock('../../src/auth/keychain', () => ({
  storeSecret: jest.fn(async (key: string, value: string) => {
    mockSecureValues.set(key, value);
  }),
  getSecret: jest.fn(async (key: string) => mockSecureValues.get(key) ?? null),
  deleteSecret: jest.fn(async (key: string) => {
    mockSecureValues.delete(key);
  }),
}));

const mockDeleteAllDeviceIdentities = jest.fn(async () => {});
const mockIsDeviceCryptoAvailable = jest.fn(() => true);
const mockIsPinnedBridgeTransportAvailable = jest.fn(() => true);
const mockHasDeviceIdentity = jest.fn(async (_keyId: string) => true);

jest.mock('../../src/auth/deviceSigning', () => ({
  deleteAllDeviceIdentities: () => mockDeleteAllDeviceIdentities(),
  hasDeviceIdentity: (keyId: string) => mockHasDeviceIdentity(keyId),
  isDeviceCryptoAvailable: () => mockIsDeviceCryptoAvailable(),
  isPinnedBridgeTransportAvailable: () => mockIsPinnedBridgeTransportAvailable(),
}));

import { branding } from '../../src/lib/branding';
import {
  clearPairedComputers,
  computerTransportKind,
  computerTransportLabel,
  loadPairedComputers,
  loadPairedComputerSummaries,
  storePairedComputers,
} from '../../src/auth/pairedComputers';
import { storeSecret } from '../../src/auth/keychain';

const COMPUTER = {
  version: 2 as const,
  bridgeId: 'bridge_1234567890',
  computerName: 'Frank’s MacBook',
  endpoint: 'https://192.168.1.20:45831/',
  tlsCertificateFingerprint: 'T'.repeat(43),
  bridgePublicKeySpki: 'A'.repeat(59),
  bridgeKeyFingerprint: 'B'.repeat(43),
  deviceId: 'device_1234567890',
  deviceKeyId: '3e399a5d-79c4-4a23-8aa7-a418565d974d',
  devicePublicKeySpki: 'D'.repeat(59),
  permissions: ['bridge:health', 'session:metadata:read'] as const,
  pairedAt: 1_800_000_000_000,
};

describe('paired computer credential storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureValues.clear();
    mockIsDeviceCryptoAvailable.mockReturnValue(true);
    mockIsPinnedBridgeTransportAvailable.mockReturnValue(true);
    mockHasDeviceIdentity.mockResolvedValue(true);
  });

  it('round-trips validated credentials through the secure-store boundary', async () => {
    await storePairedComputers([COMPUTER]);

    await expect(loadPairedComputers()).resolves.toEqual([COMPUTER]);
  });

  it('labels Tailscale addresses without changing the stored credential', () => {
    expect(computerTransportKind('https://100.127.166.87:45831/')).toBe('tailscale_vpn');
    expect(computerTransportKind('https://studio.tail1234.ts.net:45831/')).toBe(
      'tailscale_vpn',
    );
    expect(computerTransportLabel('tailscale_vpn')).toBe('Tailscale/VPN');
    expect(computerTransportKind(COMPUTER.endpoint)).toBe('local_network');
    expect(computerTransportLabel('local_network')).toBe('Same Wi-Fi');
  });

  it('exposes only non-secret computer summaries to React state', async () => {
    await storePairedComputers([COMPUTER]);

    const summaries = await loadPairedComputerSummaries();
    expect(summaries).toEqual([
      {
        bridgeId: COMPUTER.bridgeId,
        computerName: COMPUTER.computerName,
        pairedAt: COMPUTER.pairedAt,
        permissions: COMPUTER.permissions,
        transportKind: 'local_network',
      },
    ]);
    expect(JSON.stringify(summaries)).not.toContain(COMPUTER.deviceKeyId);
    expect(JSON.stringify(summaries)).not.toContain(COMPUTER.bridgePublicKeySpki);
  });

  it('fails closed on malformed or duplicate secure records', async () => {
    await storeSecret(branding.keychain.pairedComputers, '{not-json');
    await expect(loadPairedComputers()).rejects.toThrow('corrupted');

    await expect(
      storePairedComputers([COMPUTER, { ...COMPUTER, computerName: 'Duplicate computer' }]),
    ).rejects.toThrow();
  });

  it('rejects cleartext or non-network endpoint schemes', async () => {
    await expect(
      storePairedComputers([{ ...COMPUTER, endpoint: 'http://devinx-bridge.local:45831' }]),
    ).rejects.toThrow();
    await expect(
      storePairedComputers([{ ...COMPUTER, endpoint: 'file:///tmp/devinx-bridge' }]),
    ).rejects.toThrow();
  });

  it('rejects private signing key material in the credential registry', async () => {
    await expect(
      storePairedComputers([{ ...COMPUTER, devicePrivateKeyPkcs8: 'C'.repeat(64) }]),
    ).rejects.toThrow();
  });

  it('fails closed when the native signing identity or pinned transport is unavailable', async () => {
    await storePairedComputers([COMPUTER]);
    mockHasDeviceIdentity.mockResolvedValue(false);
    await expect(loadPairedComputers()).rejects.toThrow('signing identity is missing');

    mockHasDeviceIdentity.mockResolvedValue(true);
    mockIsPinnedBridgeTransportAvailable.mockReturnValue(false);
    await expect(loadPairedComputers()).rejects.toThrow('current secure transport');
  });

  it('clears native signing keys before paired-computer credentials', async () => {
    await storePairedComputers([COMPUTER]);
    await clearPairedComputers();

    expect(mockDeleteAllDeviceIdentities).toHaveBeenCalledTimes(1);
    await expect(loadPairedComputers()).resolves.toEqual([]);
  });

  it('retains paired-computer credentials when the native key wipe fails', async () => {
    await storePairedComputers([COMPUTER]);
    mockDeleteAllDeviceIdentities.mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(clearPairedComputers()).rejects.toThrow('keychain unavailable');
    await expect(loadPairedComputers()).resolves.toEqual([COMPUTER]);
  });

  it('fails closed if stored credentials cannot reach the native key namespace', async () => {
    await storePairedComputers([COMPUTER]);
    mockIsDeviceCryptoAvailable.mockReturnValue(false);

    await expect(clearPairedComputers()).rejects.toThrow('cannot be securely erased');
    await expect(loadPairedComputers()).resolves.toEqual([COMPUTER]);
  });

  it('allows a build without the module to clear an empty registry', async () => {
    mockIsDeviceCryptoAvailable.mockReturnValue(false);

    await expect(clearPairedComputers()).resolves.toBeUndefined();
    expect(mockDeleteAllDeviceIdentities).not.toHaveBeenCalled();
  });
});
