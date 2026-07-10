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
const mockVerify = jest.fn(
  async (_publicKeySpki: string, _message: string, _signature: string) => true,
);

jest.mock('../../src/auth/deviceSigning', () => ({
  createDeviceIdentity: () => mockCreateDeviceIdentity(),
  deleteDeviceIdentity: (keyId: string) => mockDeleteDeviceIdentity(keyId),
  fingerprintPublicKeySpki: (publicKeySpki: string) => mockFingerprintPublicKeySpki(publicKeySpki),
  hmacSha256: (secret: string, message: string) => mockHmacSha256(secret, message),
  postPinnedBridgeJson: (...arguments_: unknown[]) => mockPostPinnedBridgeJson(...arguments_),
  verify: (publicKeySpki: string, message: string, signature: string) =>
    mockVerify(publicKeySpki, message, signature),
}));

const mockLoadPairedComputers = jest.fn(async (): Promise<unknown[]> => []);
const mockStorePairedComputers = jest.fn(async (_input: unknown) => {});

jest.mock('../../src/auth/pairedComputers', () => {
  const actual = jest.requireActual('../../src/auth/pairedComputers');
  return {
    ...actual,
    loadPairedComputers: () => mockLoadPairedComputers(),
    storePairedComputers: (input: unknown) => mockStorePairedComputers(input),
  };
});

import { canonicalJson } from '../../src/auth/canonicalJson';
import { canonicalJson as bridgeCanonicalJson } from '../../bridge/src/canonical';
import {
  pairComputerFromQrPayload,
  setComputerPairingRuntimeForTests,
} from '../../src/auth/computerPairing';

const NOW = 1_800_000_000_000;
const OFFER = {
  protocolVersion: 1 as const,
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
  protocolVersion: 1 as const,
  bridgeId: OFFER.bridgeId,
  bridgeKeyFingerprint: OFFER.bridgeKeyFingerprint,
  bridgeEndpoint: OFFER.bridgeEndpoint,
  tlsCertificateFingerprint: OFFER.tlsCertificateFingerprint,
  deviceId: DEVICE_ID,
  pairedAt: NOW + 3_000,
  permissions: ['bridge:health', 'session:metadata:read'],
  signature: 'R'.repeat(86),
};

describe('mobile computer pairing orchestration', () => {
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

  it('matches the bridge canonical JSON ordering', () => {
    const fixture = { z: 1, a: { c: 3, b: [true, 'x'] } };
    expect(canonicalJson(fixture)).toBe('{"a":{"b":[true,"x"],"c":3},"z":1}');
    expect(canonicalJson(fixture)).toBe(bridgeCanonicalJson(fixture));
    expect(() => canonicalJson({ invalid: Number.NaN })).toThrow('finite numbers');
  });

  it('pins both bridge identities, waits for approval, verifies, and stores atomically', async () => {
    const statuses: string[] = [];
    await expect(
      pairComputerFromQrPayload(JSON.stringify(OFFER), {
        computerName: 'Frank’s MacBook',
        deviceName: 'Frank’s iPhone',
        onStatus: (status) => statuses.push(status),
      }),
    ).resolves.toEqual({
      bridgeId: OFFER.bridgeId,
      computerName: 'Frank’s MacBook',
      pairedAt: RECEIPT.pairedAt,
      permissions: RECEIPT.permissions,
    });

    expect(statuses).toEqual([
      'validating',
      'submitting',
      'waiting_for_approval',
      'saving',
      'complete',
    ]);
    expect(mockFingerprintPublicKeySpki).toHaveBeenCalledWith(OFFER.bridgePublicKeySpki);
    expect(mockHmacSha256).toHaveBeenCalledWith(
      OFFER.pairingSecret,
      expect.stringContaining(`"deviceId":"${DEVICE_ID}"`),
    );
    expect(mockPostPinnedBridgeJson).toHaveBeenNthCalledWith(
      1,
      OFFER.bridgeEndpoint,
      '/v1/pair/submit',
      OFFER.tlsCertificateFingerprint,
      expect.objectContaining({ proof: 'H'.repeat(43) }),
    );
    const { signature, ...unsignedReceipt } = RECEIPT;
    expect(mockVerify).toHaveBeenCalledWith(
      OFFER.bridgePublicKeySpki,
      canonicalJson(unsignedReceipt),
      signature,
    );
    expect(mockStorePairedComputers).toHaveBeenCalledWith([
      expect.objectContaining({
        version: 2,
        bridgeId: OFFER.bridgeId,
        endpoint: OFFER.bridgeEndpoint,
        tlsCertificateFingerprint: OFFER.tlsCertificateFingerprint,
        deviceKeyId: '3e399a5d-79c4-4a23-8aa7-a418565d974d',
      }),
    ]);
    expect(JSON.stringify(mockStorePairedComputers.mock.calls)).not.toContain(OFFER.pairingSecret);
    expect(mockDeleteDeviceIdentity).not.toHaveBeenCalled();
  });

  it('rejects expired or mismatched QR identity before creating a device key', async () => {
    await expect(
      pairComputerFromQrPayload(JSON.stringify({ ...OFFER, expiresAt: NOW - 10_000 }), {
        computerName: 'My Mac',
      }),
    ).rejects.toThrow('expired');

    mockFingerprintPublicKeySpki.mockResolvedValueOnce('X'.repeat(43));
    await expect(
      pairComputerFromQrPayload(JSON.stringify(OFFER), { computerName: 'My Mac' }),
    ).rejects.toThrow('invalid bridge identity');
    expect(mockCreateDeviceIdentity).not.toHaveBeenCalled();
  });

  it('erases the temporary device key when approval is denied or forged', async () => {
    mockPostPinnedBridgeJson.mockReset();
    mockPostPinnedBridgeJson
      .mockResolvedValueOnce({
        status: 202,
        body: { status: 'pending', pollToken: 'P'.repeat(43), expiresAt: NOW + 300_000 },
      })
      .mockResolvedValueOnce({ status: 404, body: { error: 'not_found' } });
    await expect(
      pairComputerFromQrPayload(JSON.stringify(OFFER), { computerName: 'My Mac' }),
    ).rejects.toThrow('denied or expired');
    expect(mockDeleteDeviceIdentity).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    mockLoadPairedComputers.mockResolvedValue([]);
    mockFingerprintPublicKeySpki.mockResolvedValue(OFFER.bridgeKeyFingerprint);
    mockVerify.mockResolvedValue(false);
    mockPostPinnedBridgeJson
      .mockResolvedValueOnce({
        status: 202,
        body: { status: 'pending', pollToken: 'P'.repeat(43), expiresAt: NOW + 300_000 },
      })
      .mockResolvedValueOnce({ status: 200, body: { status: 'approved', receipt: RECEIPT } });
    await expect(
      pairComputerFromQrPayload(JSON.stringify(OFFER), { computerName: 'My Mac' }),
    ).rejects.toThrow('signature is invalid');
    expect(mockDeleteDeviceIdentity).toHaveBeenCalledTimes(1);
    expect(mockStorePairedComputers).not.toHaveBeenCalled();
  });

  it('reports a cleanup failure instead of claiming pairing safely failed', async () => {
    mockPostPinnedBridgeJson.mockReset();
    mockPostPinnedBridgeJson.mockResolvedValueOnce({ status: 404, body: { error: 'not_found' } });
    mockDeleteDeviceIdentity.mockRejectedValueOnce(new Error('Keychain unavailable'));

    await expect(
      pairComputerFromQrPayload(JSON.stringify(OFFER), { computerName: 'My Mac' }),
    ).rejects.toThrow('temporary key could not be erased');
  });
});
