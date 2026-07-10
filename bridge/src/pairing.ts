import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  sign,
  timingSafeEqual,
  verify,
  type KeyObject,
} from 'node:crypto';

import { z } from 'zod';

import { canonicalJson } from './canonical';
import {
  BRIDGE_PROTOCOL_VERSION,
  bridgePermissionSchema,
  deviceNameSchema,
  deviceRecordSchema,
  opaqueIdSchema,
  type BridgePermission,
  type DeviceRecord,
} from './schemas';

const DEFAULT_OFFER_LIFETIME_MS = 120_000;
const DEFAULT_APPROVAL_LIFETIME_MS = 300_000;
const DEFAULT_MAXIMUM_OFFERS = 5;
const DEFAULT_MAXIMUM_PENDING = 20;
const MAXIMUM_PROOF_ATTEMPTS = 3;
const DEFAULT_PAIRING_PERMISSIONS: BridgePermission[] = [
  'bridge:health',
  'session:metadata:read',
];

const base64UrlSchema = z
  .string()
  .min(32)
  .max(1024)
  .regex(/^[A-Za-z0-9_-]+$/);
const pairingSecretSchema = base64UrlSchema.length(43);

export const pairingOfferSchema = z
  .object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    bridgeId: opaqueIdSchema,
    bridgePublicKeySpki: base64UrlSchema,
    bridgeKeyFingerprint: base64UrlSchema.length(43),
    pairingId: opaqueIdSchema,
    pairingSecret: pairingSecretSchema,
    expiresAt: z.number().int().positive(),
  })
  .strict();

export const unsignedPairingRequestSchema = z
  .object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    bridgeId: opaqueIdSchema,
    pairingId: opaqueIdSchema,
    deviceId: opaqueIdSchema,
    deviceName: deviceNameSchema,
    devicePublicKeySpki: base64UrlSchema,
  })
  .strict();

export const pairingRequestSchema = unsignedPairingRequestSchema
  .extend({
    proof: base64UrlSchema.length(43),
  })
  .strict();

export const pairingReceiptSchema = z
  .object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    bridgeId: opaqueIdSchema,
    bridgeKeyFingerprint: base64UrlSchema.length(43),
    deviceId: opaqueIdSchema,
    pairedAt: z.number().int().nonnegative(),
    permissions: z.array(bridgePermissionSchema).max(bridgePermissionSchema.options.length),
  })
  .strict();

export const signedPairingReceiptSchema = pairingReceiptSchema
  .extend({
    signature: base64UrlSchema.min(80).max(128),
  })
  .strict();

const pairingOptionsSchema = z
  .object({
    offerLifetimeMs: z.number().int().min(10_000).max(600_000).default(DEFAULT_OFFER_LIFETIME_MS),
    approvalLifetimeMs: z
      .number()
      .int()
      .min(10_000)
      .max(900_000)
      .default(DEFAULT_APPROVAL_LIFETIME_MS),
    maximumOffers: z.number().int().min(1).max(100).default(DEFAULT_MAXIMUM_OFFERS),
    maximumPending: z.number().int().min(1).max(100).default(DEFAULT_MAXIMUM_PENDING),
  })
  .strict();

export const devicePermissionUpdateSchema = z
  .object({
    permissions: z.array(bridgePermissionSchema).max(bridgePermissionSchema.options.length),
    allowedSessionIds: z.array(z.string().min(1).max(512)).max(10_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.permissions).size !== value.permissions.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Permissions must be unique' });
    }
    if (
      value.allowedSessionIds &&
      new Set(value.allowedSessionIds).size !== value.allowedSessionIds.length
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Session scopes must be unique' });
    }
  });

export interface BridgePairingIdentity {
  bridgeId: string;
  privateKey: KeyObject;
  publicKeySpki: string;
}

export interface PairingManagerOptions {
  offerLifetimeMs?: number;
  approvalLifetimeMs?: number;
  maximumOffers?: number;
  maximumPending?: number;
}

export interface PairingDeviceRegistry {
  register(device: DeviceRecord): Promise<boolean>;
}

export type PairingOffer = z.infer<typeof pairingOfferSchema>;
export type UnsignedPairingRequest = z.infer<typeof unsignedPairingRequestSchema>;
export type PairingRequest = z.infer<typeof pairingRequestSchema>;
export type PairingReceipt = z.infer<typeof pairingReceiptSchema>;
export type SignedPairingReceipt = z.infer<typeof signedPairingReceiptSchema>;
export type DevicePermissionUpdate = z.infer<typeof devicePermissionUpdateSchema>;

interface OfferState {
  offer: PairingOffer;
  failedProofAttempts: number;
}

interface PendingState {
  request: UnsignedPairingRequest;
  expiresAt: number;
}

export interface PendingPairingReview {
  pairingId: string;
  deviceId: string;
  deviceName: string;
  expiresAt: number;
}

export type PairingSubmissionResult =
  | { ok: true; pending: PendingPairingReview }
  | { ok: false; status: 400 | 404 | 429; body: { error: 'invalid_request' | 'not_found' | 'busy' } };

export type PairingApprovalResult =
  | { ok: true; device: DeviceRecord; receipt: SignedPairingReceipt }
  | { ok: false; status: 404; body: { error: 'not_found' } };

function publicKeyFromSpki(value: string): KeyObject | null {
  try {
    const key = createPublicKey({ key: Buffer.from(value, 'base64url'), format: 'der', type: 'spki' });
    return key.asymmetricKeyType === 'ed25519' ? key : null;
  } catch {
    return null;
  }
}

function withoutProof(request: PairingRequest): UnsignedPairingRequest {
  return {
    protocolVersion: request.protocolVersion,
    bridgeId: request.bridgeId,
    pairingId: request.pairingId,
    deviceId: request.deviceId,
    deviceName: request.deviceName,
    devicePublicKeySpki: request.devicePublicKeySpki,
  };
}

export function createPairingProof(
  pairingSecret: string,
  request: UnsignedPairingRequest,
): string {
  const secret = pairingSecretSchema.parse(pairingSecret);
  const parsedRequest = unsignedPairingRequestSchema.parse(request);
  return createHmac('sha256', Buffer.from(secret, 'base64url'))
    .update(canonicalJson(parsedRequest), 'utf8')
    .digest('base64url');
}

function proofIsValid(secret: string, request: PairingRequest): boolean {
  try {
    const expected = Buffer.from(createPairingProof(secret, withoutProof(request)), 'base64url');
    const received = Buffer.from(request.proof, 'base64url');
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export function revokeDeviceRecord(input: unknown): DeviceRecord {
  const device = deviceRecordSchema.parse(input);
  return { ...device, status: 'revoked' };
}

export function updateDevicePermissions(input: unknown, update: unknown): DeviceRecord {
  const device = deviceRecordSchema.parse(input);
  const parsedUpdate = devicePermissionUpdateSchema.parse(update);
  return deviceRecordSchema.parse({ ...device, ...parsedUpdate });
}

export function verifyPairingReceipt(
  receipt: unknown,
  bridgePublicKeySpki: string,
  expectedBridgeId: string,
): boolean {
  const result = signedPairingReceiptSchema.safeParse(receipt);
  const bridgeIdResult = opaqueIdSchema.safeParse(expectedBridgeId);
  const publicKey = publicKeyFromSpki(bridgePublicKeySpki);
  if (!result.success || !bridgeIdResult.success || !publicKey) return false;
  const expectedFingerprint = createHash('sha256')
    .update(Buffer.from(bridgePublicKeySpki, 'base64url'))
    .digest('base64url');
  if (
    result.data.bridgeId !== bridgeIdResult.data ||
    result.data.bridgeKeyFingerprint !== expectedFingerprint
  ) {
    return false;
  }
  const { signature, ...unsigned } = result.data;
  try {
    return verify(
      null,
      Buffer.from(canonicalJson(unsigned), 'utf8'),
      publicKey,
      Buffer.from(signature, 'base64url'),
    );
  } catch {
    return false;
  }
}

export class PairingManager {
  private readonly offers = new Map<string, OfferState>();
  private readonly pending = new Map<string, PendingState>();
  private readonly options: z.infer<typeof pairingOptionsSchema>;
  private readonly bridgeKeyFingerprint: string;
  private readonly bridgeId: string;
  private readonly bridgePrivateKey: KeyObject;
  private readonly bridgePublicKeySpki: string;

  constructor(
    identity: BridgePairingIdentity,
    private readonly devices: PairingDeviceRegistry,
    options: PairingManagerOptions = {},
  ) {
    opaqueIdSchema.parse(identity.bridgeId);
    base64UrlSchema.parse(identity.publicKeySpki);
    if (identity.privateKey.type !== 'private' || identity.privateKey.asymmetricKeyType !== 'ed25519') {
      throw new Error('Bridge pairing identity requires an Ed25519 private key');
    }
    const publicKey = publicKeyFromSpki(identity.publicKeySpki);
    if (!publicKey) throw new Error('Bridge pairing identity requires an Ed25519 public key');
    const identityCheck = Buffer.from('devinx-bridge-identity-check', 'utf8');
    const identitySignature = sign(null, identityCheck, identity.privateKey);
    if (!verify(null, identityCheck, publicKey, identitySignature)) {
      throw new Error('Bridge pairing identity keys do not match');
    }

    this.bridgeId = identity.bridgeId;
    this.bridgePrivateKey = identity.privateKey;
    this.bridgePublicKeySpki = identity.publicKeySpki;
    this.bridgeKeyFingerprint = createHash('sha256')
      .update(Buffer.from(identity.publicKeySpki, 'base64url'))
      .digest('base64url');
    this.options = pairingOptionsSchema.parse(options);
  }

  private cleanup(now: number): void {
    for (const [pairingId, state] of this.offers) {
      if (state.offer.expiresAt <= now) this.offers.delete(pairingId);
    }
    for (const [pairingId, state] of this.pending) {
      if (state.expiresAt <= now) this.pending.delete(pairingId);
    }
  }

  createOffer(now = Date.now()): PairingOffer {
    this.cleanup(now);
    if (this.offers.size >= this.options.maximumOffers) {
      throw new Error('Pairing offer capacity reached');
    }
    const offer = pairingOfferSchema.parse({
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      bridgeId: this.bridgeId,
      bridgePublicKeySpki: this.bridgePublicKeySpki,
      bridgeKeyFingerprint: this.bridgeKeyFingerprint,
      pairingId: randomBytes(18).toString('base64url'),
      pairingSecret: randomBytes(32).toString('base64url'),
      expiresAt: now + this.options.offerLifetimeMs,
    });
    this.offers.set(offer.pairingId, { offer: { ...offer }, failedProofAttempts: 0 });
    return { ...offer };
  }

  submit(input: unknown, now = Date.now()): PairingSubmissionResult {
    this.cleanup(now);
    const requestResult = pairingRequestSchema.safeParse(input);
    if (!requestResult.success) {
      return { ok: false, status: 400, body: { error: 'invalid_request' } };
    }
    const request = requestResult.data;
    const state = this.offers.get(request.pairingId);
    if (!state || request.bridgeId !== this.bridgeId) {
      return { ok: false, status: 404, body: { error: 'not_found' } };
    }
    if (!proofIsValid(state.offer.pairingSecret, request)) {
      state.failedProofAttempts += 1;
      if (state.failedProofAttempts >= MAXIMUM_PROOF_ATTEMPTS) {
        this.offers.delete(request.pairingId);
      }
      return { ok: false, status: 404, body: { error: 'not_found' } };
    }
    if (!publicKeyFromSpki(request.devicePublicKeySpki)) {
      this.offers.delete(request.pairingId);
      return { ok: false, status: 400, body: { error: 'invalid_request' } };
    }
    if (this.pending.size >= this.options.maximumPending) {
      return { ok: false, status: 429, body: { error: 'busy' } };
    }

    this.offers.delete(request.pairingId);
    const pending: PendingState = {
      request: withoutProof(request),
      expiresAt: now + this.options.approvalLifetimeMs,
    };
    this.pending.set(request.pairingId, pending);
    return {
      ok: true,
      pending: {
        pairingId: request.pairingId,
        deviceId: request.deviceId,
        deviceName: request.deviceName,
        expiresAt: pending.expiresAt,
      },
    };
  }

  async approve(pairingId: string, now = Date.now()): Promise<PairingApprovalResult> {
    this.cleanup(now);
    const pairingIdResult = opaqueIdSchema.safeParse(pairingId);
    if (!pairingIdResult.success) {
      return { ok: false, status: 404, body: { error: 'not_found' } };
    }
    const state = this.pending.get(pairingIdResult.data);
    if (!state) return { ok: false, status: 404, body: { error: 'not_found' } };
    this.pending.delete(pairingIdResult.data);

    const device = deviceRecordSchema.parse({
      bridgeId: this.bridgeId,
      deviceId: state.request.deviceId,
      deviceName: state.request.deviceName,
      publicKeySpki: state.request.devicePublicKeySpki,
      status: 'active',
      pairedAt: now,
      permissions: DEFAULT_PAIRING_PERMISSIONS,
    });
    const receipt = pairingReceiptSchema.parse({
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      bridgeId: this.bridgeId,
      bridgeKeyFingerprint: this.bridgeKeyFingerprint,
      deviceId: device.deviceId,
      pairedAt: now,
      permissions: device.permissions,
    });
    const storedDevice: DeviceRecord = {
      ...device,
      permissions: [...device.permissions],
      allowedSessionIds: device.allowedSessionIds ? [...device.allowedSessionIds] : undefined,
    };
    if (!(await this.devices.register(storedDevice))) {
      return { ok: false, status: 404, body: { error: 'not_found' } };
    }
    const signedReceipt = signedPairingReceiptSchema.parse({
      ...receipt,
      signature: sign(
        null,
        Buffer.from(canonicalJson(receipt), 'utf8'),
        this.bridgePrivateKey,
      ).toString('base64url'),
    });
    return {
      ok: true,
      device: {
        ...device,
        permissions: [...device.permissions],
        allowedSessionIds: device.allowedSessionIds ? [...device.allowedSessionIds] : undefined,
      },
      receipt: signedReceipt,
    };
  }

  deny(pairingId: string): boolean {
    const pairingIdResult = opaqueIdSchema.safeParse(pairingId);
    if (!pairingIdResult.success) return false;
    return this.pending.delete(pairingIdResult.data);
  }

  verifyReceipt(receipt: unknown): boolean {
    return verifyPairingReceipt(receipt, this.bridgePublicKeySpki, this.bridgeId);
  }
}
