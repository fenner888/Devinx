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

import { branding } from '../../src/lib/branding';
import {
  clearPairedComputers,
  loadPairedComputers,
  loadPairedComputerSummaries,
  storePairedComputers,
} from '../../src/auth/pairedComputers';
import { storeSecret } from '../../src/auth/keychain';

const COMPUTER = {
  version: 1 as const,
  bridgeId: 'bridge_1234567890',
  computerName: 'Frank’s MacBook',
  endpoint: 'https://devinx-bridge.local:45831',
  bridgePublicKeySpki: 'A'.repeat(59),
  bridgeKeyFingerprint: 'B'.repeat(43),
  deviceId: 'device_1234567890',
  devicePrivateKeyPkcs8: 'C'.repeat(64),
  devicePublicKeySpki: 'D'.repeat(59),
  permissions: ['bridge:health', 'session:metadata:read'] as const,
  pairedAt: 1_800_000_000_000,
};

describe('paired computer credential storage', () => {
  beforeEach(() => mockSecureValues.clear());

  it('round-trips validated credentials through the secure-store boundary', async () => {
    await storePairedComputers([COMPUTER]);

    await expect(loadPairedComputers()).resolves.toEqual([COMPUTER]);
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
      },
    ]);
    expect(JSON.stringify(summaries)).not.toContain(COMPUTER.devicePrivateKeyPkcs8);
    expect(JSON.stringify(summaries)).not.toContain(COMPUTER.bridgePublicKeySpki);
  });

  it('fails closed on malformed or duplicate secure records', async () => {
    await storeSecret(branding.keychain.pairedComputers, '{not-json');
    await expect(loadPairedComputers()).rejects.toThrow('corrupted');

    await expect(
      storePairedComputers([
        COMPUTER,
        { ...COMPUTER, computerName: 'Duplicate computer' },
      ]),
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

  it('clears all paired-computer credentials', async () => {
    await storePairedComputers([COMPUTER]);
    await clearPairedComputers();

    await expect(loadPairedComputers()).resolves.toEqual([]);
  });
});
