const mockCreateDeviceIdentity = jest.fn(async () => ({
  keyId: '3e399a5d-79c4-4a23-8aa7-a418565d974d',
  publicKeySpki: 'D'.repeat(59),
}));
const mockDeleteDeviceIdentity = jest.fn(async (_keyId: string) => {});
const mockFingerprintPublicKeySpki = jest.fn(async (_publicKeySpki: string) => 'B'.repeat(43));
const mockHmacSha256 = jest.fn(async (_secret: string, _message: string) => 'H'.repeat(43));
const mockPostPinnedBridgeJson = jest.fn(async (..._arguments: unknown[]): Promise<unknown> => ({
  status: 202,
  body: { status: 'pending', pollToken: 'P'.repeat(43), expiresAt: 1_800_000_300_000 },
}));
const mockPostTailnetBridgeJson = jest.fn(async (..._arguments: unknown[]): Promise<unknown> => ({
  status: 202,
  body: { status: 'pending', pollToken: 'P'.repeat(43), expiresAt: 1_800_000_300_000 },
}));
const mockVerify = jest.fn(
  async (_publicKeySpki: string, _message: string, _signature: string) => true,
);

jest.mock('../../src/auth/deviceSigning', () => ({
  createDeviceIdentity: () => mockCreateDeviceIdentity(),
  deleteDeviceIdentity: (keyId: string) => mockDeleteDeviceIdentity(keyId),
  fingerprintPublicKeySpki: (publicKeySpki: string) => mockFingerprintPublicKeySpki(publicKeySpki),
  hmacSha256: (secret: string, message: string) => mockHmacSha256(secret, message),
  postPinnedBridgeJson: (...arguments_: unknown[]) => mockPostPinnedBridgeJson(...arguments_),
  postTailnetBridgeJson: (...arguments_: unknown[]) => mockPostTailnetBridgeJson(...arguments_),
  verify: (publicKeySpki: string, message: string, signature: string) =>
    mockVerify(publicKeySpki, message, signature),
}));

const mockLoadPairedComputers = jest.fn(async (): Promise<unknown[]> => []);
const mockStorePairedComputers = jest.fn(async (_input: unknown) => {});
const mockVerifyComputerBridgeCredential = jest.fn(async (_input: unknown) => ({
  protocolVersion: 2,
  status: 'ready',
  capabilities: {
    sessionList: true,
    sessionLoad: true,
    sessionPrompt: false,
  },
}));

jest.mock('../../src/auth/computerBridge', () => {
  const actual = jest.requireActual('../../src/auth/computerBridge');
  return {
    ...actual,
    verifyComputerBridgeCredential: (input: unknown) => mockVerifyComputerBridgeCredential(input),
  };
});

jest.mock('../../src/auth/pairedComputers', () => {
  const actual = jest.requireActual('../../src/auth/pairedComputers');
  return {
    ...actual,
    loadPairedComputers: () => mockLoadPairedComputers(),
    storePairedComputers: (input: unknown) => mockStorePairedComputers(input),
  };
});

import { pairComputerFromQrPayload, setComputerPairingRuntimeForTests } from '../../src/auth/computerPairing';

const NOW = 1_800_000_000_000;
const OFFER = {
  protocolVersion: 2 as const,
  transportSecurity: 'pinned_tls' as const,
  bridgeId: 'bridge_1234567890',
  bridgePublicKeySpki: 'A'.repeat(59),
  bridgeKeyFingerprint: 'B'.repeat(43),
  bridgeEndpoint: 'https://192.168.1.20:45831/',
  tlsCertificateFingerprint: 'T'.repeat(43),
  pairingId: 'pairing_1234567890',
  pairingSecret: 'S'.repeat(43),
  expiresAt: NOW + 120_000,
};
const DEVICE_ID = 'device_3e399a5d79c44a238aa7a418565d974d';
const RECEIPT = {
  protocolVersion: 2 as const,
  bridgeId: OFFER.bridgeId,
  bridgeKeyFingerprint: OFFER.bridgeKeyFingerprint,
  transportSecurity: OFFER.transportSecurity,
  bridgeEndpoint: OFFER.bridgeEndpoint,
  tlsCertificateFingerprint: OFFER.tlsCertificateFingerprint,
  deviceId: DEVICE_ID,
  pairedAt: NOW + 3_000,
  permissions: ['bridge:health', 'session:metadata:read'],
  signature: 'R'.repeat(86),
};

describe('Connector-provided pairing computer names', () => {
  let now: number;

  beforeEach(() => {
    jest.clearAllMocks();
    now = NOW;
    setComputerPairingRuntimeForTests({
      now: () => now,
      wait: async (milliseconds, signal) => {
        if (signal?.aborted) throw new Error('Computer pairing was cancelled');
        now += milliseconds;
      },
    });
    mockFingerprintPublicKeySpki.mockResolvedValue(OFFER.bridgeKeyFingerprint);
    mockVerify.mockResolvedValue(true);
    mockLoadPairedComputers.mockResolvedValue([]);
    mockPostPinnedBridgeJson
      .mockResolvedValueOnce({
        status: 202,
        body: { status: 'pending', pollToken: 'P'.repeat(43), expiresAt: NOW + 300_000 },
      })
      .mockResolvedValueOnce({
        status: 202,
        body: { status: 'pending', expiresAt: NOW + 300_000 },
      })
      .mockResolvedValueOnce({ status: 200, body: { status: 'approved', receipt: RECEIPT } });
  });

  afterEach(() => setComputerPairingRuntimeForTests(undefined));

  it('uses and stores the Connector name when requested', async () => {
    const connectorName = "Mark's MacBook Pro";

    await expect(
      pairComputerFromQrPayload(JSON.stringify({ ...OFFER, computerName: connectorName }), {
        computerName: 'My Mac',
        useConnectorComputerName: true,
      }),
    ).resolves.toMatchObject({ computerName: connectorName });
    expect(mockStorePairedComputers).toHaveBeenCalledWith([
      expect.objectContaining({ computerName: connectorName }),
    ]);
  });

  it('uses the entered name when Connector names are not preferred', async () => {
    await expect(
      pairComputerFromQrPayload(
        JSON.stringify({ ...OFFER, computerName: "Mark's MacBook Pro" }),
        { computerName: 'Work PC', useConnectorComputerName: false },
      ),
    ).resolves.toMatchObject({ computerName: 'Work PC' });
  });

  it('uses the entered name when the offer has no name', async () => {
    await expect(
      pairComputerFromQrPayload(JSON.stringify(OFFER), {
        computerName: 'My Mac',
        useConnectorComputerName: true,
      }),
    ).resolves.toMatchObject({ computerName: 'My Mac' });
  });

  it.each([
    ['an 81-character name', 'a'.repeat(81)],
    ['a control character', 'Office\nMac'],
  ])('rejects an offer containing %s', async (_description, computerName) => {
    await expect(
      pairComputerFromQrPayload(JSON.stringify({ ...OFFER, computerName }), {
        computerName: 'My Mac',
        useConnectorComputerName: true,
      }),
    ).rejects.toMatchObject({ code: 'pairing_code_invalid' });
  });

  it('preserves the stored name while migrating an existing pairing', async () => {
    const existing = {
      version: 2 as const,
      bridgeId: OFFER.bridgeId,
      computerName: 'Stored Studio Mac',
      endpoint: OFFER.bridgeEndpoint,
      tlsCertificateFingerprint: OFFER.tlsCertificateFingerprint,
      bridgePublicKeySpki: OFFER.bridgePublicKeySpki,
      bridgeKeyFingerprint: OFFER.bridgeKeyFingerprint,
      deviceId: DEVICE_ID,
      deviceKeyId: '3e399a5d-79c4-4a23-8aa7-a418565d974d',
      devicePublicKeySpki: 'D'.repeat(59),
      permissions: ['bridge:health', 'session:metadata:read'] as const,
      pairedAt: NOW - 60_000,
    };
    const tailscaleOffer = {
      ...OFFER,
      computerName: 'Connector Renamed Mac',
      transportSecurity: 'tailscale_wireguard' as const,
      bridgeEndpoint: 'http://100.127.166.87:45831/',
    };
    mockLoadPairedComputers.mockResolvedValueOnce([existing]).mockResolvedValueOnce([existing]);

    await expect(
      pairComputerFromQrPayload(JSON.stringify(tailscaleOffer), {
        computerName: 'My Mac',
        useConnectorComputerName: true,
      }),
    ).resolves.toMatchObject({ computerName: 'Stored Studio Mac' });
  });
});
