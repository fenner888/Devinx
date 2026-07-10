import { requireOptionalNativeModule } from 'expo';
import { z } from 'zod';

const base64UrlSchema = z.string().min(1).max(2048).regex(/^[A-Za-z0-9_-]+$/);
const keyIdSchema = z.string().uuid();
const publicKeySpkiSchema = base64UrlSchema.length(59);
const signatureSchema = base64UrlSchema.length(86);
const pairingSecretSchema = base64UrlSchema.length(43);
const messageSchema = z.string().min(1).max(1_048_576);

const deviceIdentitySchema = z
  .object({
    keyId: keyIdSchema,
    publicKeySpki: publicKeySpkiSchema,
  })
  .strict();

interface DevinXDeviceCryptoNativeModule {
  createDeviceIdentity(): Promise<unknown>;
  sign(keyId: string, message: string): Promise<unknown>;
  verify(publicKeySpki: string, message: string, signature: string): Promise<unknown>;
  hmacSha256(secret: string, message: string): Promise<unknown>;
  hasDeviceIdentity(keyId: string): Promise<unknown>;
  deleteDeviceIdentity(keyId: string): Promise<void>;
  deleteAllDeviceIdentities(): Promise<void>;
}

export interface DeviceIdentity {
  keyId: string;
  publicKeySpki: string;
}

let nativeModuleOverride: DevinXDeviceCryptoNativeModule | undefined;

function resolveNativeModule(): DevinXDeviceCryptoNativeModule | null {
  return (
    nativeModuleOverride ??
    requireOptionalNativeModule<DevinXDeviceCryptoNativeModule>('DevinXDeviceCrypto')
  );
}

function getNativeModule(): DevinXDeviceCryptoNativeModule {
  const nativeModule = resolveNativeModule();
  if (!nativeModule) {
    throw new Error('Computer pairing requires a DevinX iOS development or release build');
  }
  return nativeModule;
}

export function isDeviceCryptoAvailable(): boolean {
  return resolveNativeModule() !== null;
}

export async function createDeviceIdentity(): Promise<DeviceIdentity> {
  return deviceIdentitySchema.parse(await getNativeModule().createDeviceIdentity());
}

export async function sign(keyId: string, message: string): Promise<string> {
  return signatureSchema.parse(
    await getNativeModule().sign(keyIdSchema.parse(keyId), messageSchema.parse(message)),
  );
}

export async function verify(
  publicKeySpki: string,
  message: string,
  signature: string,
): Promise<boolean> {
  return z.boolean().parse(
    await getNativeModule().verify(
      publicKeySpkiSchema.parse(publicKeySpki),
      messageSchema.parse(message),
      signatureSchema.parse(signature),
    ),
  );
}

export async function hmacSha256(secret: string, message: string): Promise<string> {
  return base64UrlSchema.length(43).parse(
    await getNativeModule().hmacSha256(
      pairingSecretSchema.parse(secret),
      messageSchema.parse(message),
    ),
  );
}

export async function hasDeviceIdentity(keyId: string): Promise<boolean> {
  return z.boolean().parse(
    await getNativeModule().hasDeviceIdentity(keyIdSchema.parse(keyId)),
  );
}

export async function deleteDeviceIdentity(keyId: string): Promise<void> {
  await getNativeModule().deleteDeviceIdentity(keyIdSchema.parse(keyId));
}

export async function deleteAllDeviceIdentities(): Promise<void> {
  await getNativeModule().deleteAllDeviceIdentities();
}

export function setDeviceCryptoNativeModuleForTests(
  nativeModule: DevinXDeviceCryptoNativeModule | undefined,
): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Native module overrides are test-only');
  }
  nativeModuleOverride = nativeModule;
}
