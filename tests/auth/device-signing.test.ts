import {
  createDeviceIdentity,
  createRequestIdentity,
  deleteAllDeviceIdentities,
  deleteDeviceIdentity,
  fingerprintPublicKeySpki,
  getQrScannerPermissionStatus,
  hasDeviceIdentity,
  hmacSha256,
  isDeviceCryptoAvailable,
  isPinnedBridgeTransportAvailable,
  isQrScannerAvailable,
  postPinnedBridgeJson,
  requestQrScannerPermission,
  setDeviceCryptoNativeModuleForTests,
  sign,
  verify,
} from '../../src/auth/deviceSigning';

const KEY_ID = '3e399a5d-79c4-4a23-8aa7-a418565d974d';
const PUBLIC_KEY = 'A'.repeat(59);
const SIGNATURE = 'B'.repeat(86);
const PAIRING_SECRET = 'C'.repeat(43);
const HMAC = 'D'.repeat(43);

function createNativeModule() {
  return {
    createDeviceIdentity: jest.fn(async () => ({ keyId: KEY_ID, publicKeySpki: PUBLIC_KEY })),
    createRequestIdentity: jest.fn(async () => ({
      requestId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
      nonce: 'N'.repeat(32),
    })),
    sign: jest.fn(async () => SIGNATURE),
    verify: jest.fn(async () => true),
    hmacSha256: jest.fn(async () => HMAC),
    fingerprintPublicKeySpki: jest.fn(async () => 'F'.repeat(43)),
    getQrScannerPermissionStatus: jest.fn(async () => 'notDetermined'),
    requestQrScannerPermission: jest.fn(async () => 'authorized'),
    hasDeviceIdentity: jest.fn(async () => true),
    deleteDeviceIdentity: jest.fn(async () => {}),
    deleteAllDeviceIdentities: jest.fn(async () => {}),
    postPinnedJson: jest.fn(async () => ({ status: 202, body: '{"status":"pending"}' })),
  };
}

describe('iOS device signing boundary', () => {
  afterEach(() => setDeviceCryptoNativeModuleForTests(undefined));

  it('validates native identities and never returns private key material', async () => {
    const nativeModule = createNativeModule();
    setDeviceCryptoNativeModuleForTests(nativeModule);

    expect(isDeviceCryptoAvailable()).toBe(true);
    await expect(createDeviceIdentity()).resolves.toEqual({
      keyId: KEY_ID,
      publicKeySpki: PUBLIC_KEY,
    });
    expect(JSON.stringify(await createDeviceIdentity())).not.toContain('private');
  });

  it('validates and delegates signing, receipt verification, and pairing HMAC', async () => {
    const nativeModule = createNativeModule();
    setDeviceCryptoNativeModuleForTests(nativeModule);

    await expect(sign(KEY_ID, 'canonical request')).resolves.toBe(SIGNATURE);
    await expect(verify(PUBLIC_KEY, 'canonical receipt', SIGNATURE)).resolves.toBe(true);
    await expect(hmacSha256(PAIRING_SECRET, 'canonical proof')).resolves.toBe(HMAC);
    await expect(fingerprintPublicKeySpki(PUBLIC_KEY)).resolves.toBe('F'.repeat(43));
    await expect(hasDeviceIdentity(KEY_ID)).resolves.toBe(true);
    await expect(createRequestIdentity()).resolves.toEqual({
      requestId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
      nonce: 'N'.repeat(32),
    });
  });

  it('validates all values returned by native code', async () => {
    const nativeModule = createNativeModule();
    nativeModule.createDeviceIdentity.mockResolvedValueOnce({
      keyId: KEY_ID,
      publicKeySpki: 'not valid!',
    });
    nativeModule.sign.mockResolvedValueOnce('short');
    nativeModule.verify.mockResolvedValueOnce('yes' as never);
    nativeModule.createRequestIdentity.mockResolvedValueOnce({ requestId: 'bad', nonce: 'short' });
    setDeviceCryptoNativeModuleForTests(nativeModule);

    await expect(createDeviceIdentity()).rejects.toThrow();
    await expect(sign(KEY_ID, 'request')).rejects.toThrow();
    await expect(verify(PUBLIC_KEY, 'receipt', SIGNATURE)).rejects.toThrow();
    await expect(createRequestIdentity()).rejects.toThrow();
  });

  it('validates and delegates only canonical pinned bridge requests', async () => {
    const nativeModule = createNativeModule();
    setDeviceCryptoNativeModuleForTests(nativeModule);

    expect(isPinnedBridgeTransportAvailable()).toBe(true);
    await expect(
      postPinnedBridgeJson('https://192.168.1.20:45831/', '/v1/pair/submit', 'F'.repeat(43), {
        pairing: 'request',
      }),
    ).resolves.toEqual({ status: 202, body: { status: 'pending' } });
    expect(nativeModule.postPinnedJson).toHaveBeenCalledWith(
      'https://192.168.1.20:45831/',
      '/v1/pair/submit',
      'F'.repeat(43),
      '{"pairing":"request"}',
    );

    await expect(
      postPinnedBridgeJson('http://192.168.1.20:45831/', '/v1/pair/submit', 'F'.repeat(43), {}),
    ).rejects.toThrow();
    await expect(
      postPinnedBridgeJson(
        'https://192.168.1.20:45831/not-an-origin',
        '/v1/pair/submit',
        'F'.repeat(43),
        {},
      ),
    ).rejects.toThrow();
  });

  it('exposes a validated native QR camera permission boundary', async () => {
    const nativeModule = createNativeModule();
    setDeviceCryptoNativeModuleForTests(nativeModule);

    expect(isQrScannerAvailable()).toBe(true);
    await expect(getQrScannerPermissionStatus()).resolves.toBe('notDetermined');
    await expect(requestQrScannerPermission()).resolves.toBe('authorized');

    nativeModule.getQrScannerPermissionStatus.mockResolvedValueOnce('unknown');
    await expect(getQrScannerPermissionStatus()).rejects.toThrow();
  });

  it('fails closed on malformed native bridge responses', async () => {
    const nativeModule = createNativeModule();
    nativeModule.postPinnedJson.mockResolvedValueOnce({ status: 200, body: 'not json' });
    setDeviceCryptoNativeModuleForTests(nativeModule);

    await expect(
      postPinnedBridgeJson('https://192.168.1.20:45831/', '/v1/pair/status', 'F'.repeat(43), {}),
    ).rejects.toThrow('not valid JSON');
  });

  it('rejects malformed or oversized inputs before calling native code', async () => {
    const nativeModule = createNativeModule();
    setDeviceCryptoNativeModuleForTests(nativeModule);

    await expect(sign('not-a-key-id', 'request')).rejects.toThrow();
    await expect(sign(KEY_ID, '')).rejects.toThrow();
    await expect(sign(KEY_ID, 'x'.repeat(1_048_577))).rejects.toThrow();
    await expect(hmacSha256('bad', 'proof')).rejects.toThrow();
    expect(nativeModule.sign).not.toHaveBeenCalled();
    expect(nativeModule.hmacSha256).not.toHaveBeenCalled();
  });

  it('supports idempotent native key lifecycle operations', async () => {
    const nativeModule = createNativeModule();
    setDeviceCryptoNativeModuleForTests(nativeModule);

    await deleteDeviceIdentity(KEY_ID);
    await deleteAllDeviceIdentities();
    expect(nativeModule.deleteDeviceIdentity).toHaveBeenCalledWith(KEY_ID);
    expect(nativeModule.deleteAllDeviceIdentities).toHaveBeenCalledTimes(1);
  });
});
