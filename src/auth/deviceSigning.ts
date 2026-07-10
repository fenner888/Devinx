import { requireOptionalNativeModule } from 'expo';
import { z } from 'zod';

const base64UrlSchema = z
  .string()
  .min(1)
  .max(2048)
  .regex(/^[A-Za-z0-9_-]+$/);
const keyIdSchema = z.string().uuid();
const publicKeySpkiSchema = base64UrlSchema.length(59);
const signatureSchema = base64UrlSchema.length(86);
const pairingSecretSchema = base64UrlSchema.length(43);
const messageSchema = z.string().min(1).max(1_048_576);
const bridgeEndpointSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        url.username === '' &&
        url.password === '' &&
        url.pathname === '/' &&
        url.search === '' &&
        url.hash === '' &&
        url.port !== '' &&
        url.toString() === value
      );
    } catch {
      return false;
    }
  }, 'Bridge endpoint must be a canonical HTTPS origin with an explicit port');
const bridgePathSchema = z.enum(['/v1/pair/submit', '/v1/pair/status', '/v1/request']);
const certificateFingerprintSchema = base64UrlSchema.length(43);
const nativePinnedResponseSchema = z
  .object({
    status: z.union([
      z.literal(200),
      z.literal(202),
      z.literal(400),
      z.literal(404),
      z.literal(429),
      z.literal(503),
    ]),
    body: z
      .string()
      .min(1)
      .max(256 * 1024),
  })
  .strict();

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
  postPinnedJson?(
    endpoint: string,
    path: string,
    certificateFingerprint: string,
    body: string,
  ): Promise<unknown>;
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
  return z
    .boolean()
    .parse(
      await getNativeModule().verify(
        publicKeySpkiSchema.parse(publicKeySpki),
        messageSchema.parse(message),
        signatureSchema.parse(signature),
      ),
    );
}

export async function hmacSha256(secret: string, message: string): Promise<string> {
  return base64UrlSchema
    .length(43)
    .parse(
      await getNativeModule().hmacSha256(
        pairingSecretSchema.parse(secret),
        messageSchema.parse(message),
      ),
    );
}

export async function hasDeviceIdentity(keyId: string): Promise<boolean> {
  return z.boolean().parse(await getNativeModule().hasDeviceIdentity(keyIdSchema.parse(keyId)));
}

export async function deleteDeviceIdentity(keyId: string): Promise<void> {
  await getNativeModule().deleteDeviceIdentity(keyIdSchema.parse(keyId));
}

export async function deleteAllDeviceIdentities(): Promise<void> {
  await getNativeModule().deleteAllDeviceIdentities();
}

export interface PinnedBridgeResponse {
  status: 200 | 202 | 400 | 404 | 429 | 503;
  body: Record<string, unknown>;
}

export function isPinnedBridgeTransportAvailable(): boolean {
  return typeof resolveNativeModule()?.postPinnedJson === 'function';
}

export async function postPinnedBridgeJson(
  endpoint: string,
  path: '/v1/pair/submit' | '/v1/pair/status' | '/v1/request',
  certificateFingerprint: string,
  input: unknown,
): Promise<PinnedBridgeResponse> {
  const nativeModule = getNativeModule();
  if (!nativeModule.postPinnedJson) {
    throw new Error('Secure computer transport requires a current DevinX iOS build');
  }
  const parsedInput = z.record(z.unknown()).parse(input);
  const serialized = JSON.stringify(parsedInput);
  if (serialized.length > 256 * 1024) {
    throw new Error('Bridge request exceeds the secure transport limit');
  }
  const result = nativePinnedResponseSchema.parse(
    await nativeModule.postPinnedJson(
      bridgeEndpointSchema.parse(endpoint),
      bridgePathSchema.parse(path),
      certificateFingerprintSchema.parse(certificateFingerprint),
      serialized,
    ),
  );
  let body: unknown;
  try {
    body = JSON.parse(result.body);
  } catch {
    throw new Error('Bridge response was not valid JSON');
  }
  return { status: result.status, body: z.record(z.unknown()).parse(body) };
}

export function setDeviceCryptoNativeModuleForTests(
  nativeModule: DevinXDeviceCryptoNativeModule | undefined,
): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Native module overrides are test-only');
  }
  nativeModuleOverride = nativeModule;
}
