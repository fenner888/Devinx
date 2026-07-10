import {
  createDeviceIdentity,
  deleteAllDeviceIdentities,
  deleteDeviceIdentity,
  hasDeviceIdentity,
  hmacSha256,
  isDeviceCryptoAvailable,
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
    sign: jest.fn(async () => SIGNATURE),
    verify: jest.fn(async () => true),
    hmacSha256: jest.fn(async () => HMAC),
    hasDeviceIdentity: jest.fn(async () => true),
    deleteDeviceIdentity: jest.fn(async () => {}),
    deleteAllDeviceIdentities: jest.fn(async () => {}),
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
    await expect(hasDeviceIdentity(KEY_ID)).resolves.toBe(true);
  });

  it('validates all values returned by native code', async () => {
    const nativeModule = createNativeModule();
    nativeModule.createDeviceIdentity.mockResolvedValueOnce({
      keyId: KEY_ID,
      publicKeySpki: 'not valid!',
    });
    nativeModule.sign.mockResolvedValueOnce('short');
    nativeModule.verify.mockResolvedValueOnce('yes' as never);
    setDeviceCryptoNativeModuleForTests(nativeModule);

    await expect(createDeviceIdentity()).rejects.toThrow();
    await expect(sign(KEY_ID, 'request')).rejects.toThrow();
    await expect(verify(PUBLIC_KEY, 'receipt', SIGNATURE)).rejects.toThrow();
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
