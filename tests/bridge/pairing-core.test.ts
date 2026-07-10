import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';

import {
  PairingManager,
  createPairingProof,
  revokeDeviceRecord,
  updateDevicePermissions,
  verifyPairingReceipt,
  type PairingOffer,
  type PairingRequest,
  type PairingDeviceRegistry,
  type UnsignedPairingRequest,
} from '../../bridge/src/pairing';
import { BRIDGE_PROTOCOL_VERSION } from '../../bridge/src/schemas';

const NOW = 1_800_000_000_000;
const BRIDGE_ID = 'bridge_1234567890';
const DEVICE_ID = 'device_1234567890';

describe('Desktop Bridge pairing core', () => {
  const bridgeKeys = generateKeyPairSync('ed25519');
  const bridgePublicKeySpki = bridgeKeys.publicKey
    .export({ format: 'der', type: 'spki' })
    .toString('base64url');
  let devicePublicKeySpki: string;
  let registeredDevices: Map<string, unknown>;
  let registry: PairingDeviceRegistry;
  let manager: PairingManager;

  beforeEach(() => {
    devicePublicKeySpki = generateKeyPairSync('ed25519').publicKey.export({
      format: 'der',
      type: 'spki',
    }).toString('base64url');
    registeredDevices = new Map();
    registry = {
      register: (device) => {
        if (registeredDevices.has(device.deviceId)) return false;
        registeredDevices.set(device.deviceId, device);
        return true;
      },
    };
    manager = new PairingManager({
      bridgeId: BRIDGE_ID,
      privateKey: bridgeKeys.privateKey,
      publicKeySpki: bridgePublicKeySpki,
    }, registry);
  });

  function pairingRequest(
    offer: PairingOffer,
    overrides: Partial<UnsignedPairingRequest> = {},
  ): PairingRequest {
    const unsigned: UnsignedPairingRequest = {
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      bridgeId: offer.bridgeId,
      pairingId: offer.pairingId,
      deviceId: DEVICE_ID,
      deviceName: 'Frank’s iPhone',
      devicePublicKeySpki,
      ...overrides,
    };
    return {
      ...unsigned,
      proof: createPairingProof(offer.pairingSecret, unsigned),
    };
  }

  it('creates a short-lived offer pinned to the bridge public key', () => {
    const offer = manager.createOffer(NOW);
    const fingerprint = createHash('sha256')
      .update(Buffer.from(bridgePublicKeySpki, 'base64url'))
      .digest('base64url');

    expect(offer).toMatchObject({
      protocolVersion: 1,
      bridgeId: BRIDGE_ID,
      bridgePublicKeySpki,
      bridgeKeyFingerprint: fingerprint,
      expiresAt: NOW + 120_000,
    });
    expect(Buffer.from(offer.pairingSecret, 'base64url')).toHaveLength(32);
  });

  it('requires desktop approval and grants only read-only defaults', () => {
    const offer = manager.createOffer(NOW);
    const request = pairingRequest(offer);

    const submission = manager.submit(request, NOW + 1_000);
    expect(submission).toMatchObject({
      ok: true,
      pending: {
        pairingId: offer.pairingId,
        deviceId: DEVICE_ID,
        deviceName: 'Frank’s iPhone',
      },
    });
    expect(manager.submit(request, NOW + 2_000)).toEqual({
      ok: false,
      status: 404,
      body: { error: 'not_found' },
    });

    const approval = manager.approve(offer.pairingId, NOW + 3_000);
    expect(approval).toMatchObject({
      ok: true,
      device: {
        bridgeId: BRIDGE_ID,
        deviceId: DEVICE_ID,
        deviceName: 'Frank’s iPhone',
        status: 'active',
        pairedAt: NOW + 3_000,
        permissions: ['bridge:health', 'session:metadata:read'],
      },
    });
    if (!approval.ok) throw new Error('Expected pairing approval');
    expect(approval.device.permissions).not.toContain('session:content:read');
    expect(approval.device.permissions).not.toContain('session:prompt:send');
    expect(registeredDevices.get(DEVICE_ID)).toEqual(approval.device);
    approval.device.permissions.push('session:content:read');
    expect(registeredDevices.get(DEVICE_ID)).toMatchObject({
      permissions: ['bridge:health', 'session:metadata:read'],
    });
    expect(manager.verifyReceipt(approval.receipt)).toBe(true);
    expect(verifyPairingReceipt(approval.receipt, bridgePublicKeySpki, BRIDGE_ID)).toBe(true);
  });

  it('invalidates an offer after repeated incorrect proofs', () => {
    const offer = manager.createOffer(NOW);
    const request = pairingRequest(offer);
    request.proof = randomBytes(32).toString('base64url');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(manager.submit(request, NOW + attempt)).toEqual({
        ok: false,
        status: 404,
        body: { error: 'not_found' },
      });
    }
    const validRequest = pairingRequest(offer);
    expect(manager.submit(validRequest, NOW + 10)).toEqual({
      ok: false,
      status: 404,
      body: { error: 'not_found' },
    });
  });

  it('keeps the stored offer isolated from mutations to the returned QR object', () => {
    const offer = manager.createOffer(NOW);
    const request = pairingRequest(offer);
    offer.pairingSecret = randomBytes(32).toString('base64url');
    offer.expiresAt = NOW;

    expect(manager.submit(request, NOW + 1).ok).toBe(true);
  });

  it('rejects expired offers without disclosing their state', () => {
    const offer = manager.createOffer(NOW);

    expect(manager.submit(pairingRequest(offer), NOW + 120_001)).toEqual({
      ok: false,
      status: 404,
      body: { error: 'not_found' },
    });
  });

  it('rejects a non-Ed25519 device key and consumes the offer', () => {
    const offer = manager.createOffer(NOW);
    const rsaPublicKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64url');
    const request = pairingRequest(offer, { devicePublicKeySpki: rsaPublicKey });

    expect(manager.submit(request, NOW + 1)).toEqual({
      ok: false,
      status: 400,
      body: { error: 'invalid_request' },
    });
    expect(manager.submit(pairingRequest(offer), NOW + 2)).toMatchObject({ ok: false, status: 404 });
  });

  it('supports explicit denial and prevents later approval', () => {
    const offer = manager.createOffer(NOW);
    expect(manager.submit(pairingRequest(offer), NOW + 1).ok).toBe(true);

    expect(manager.deny(offer.pairingId)).toBe(true);
    expect(manager.approve(offer.pairingId, NOW + 2)).toEqual({
      ok: false,
      status: 404,
      body: { error: 'not_found' },
    });
  });

  it('does not overwrite an existing device public key', () => {
    registeredDevices.set(DEVICE_ID, { existing: true });
    const offer = manager.createOffer(NOW);
    manager.submit(pairingRequest(offer), NOW + 1);

    expect(manager.approve(offer.pairingId, NOW + 2)).toEqual({
      ok: false,
      status: 404,
      body: { error: 'not_found' },
    });
    expect(registeredDevices.get(DEVICE_ID)).toEqual({ existing: true });
  });

  it('detects a tampered approval receipt', () => {
    const offer = manager.createOffer(NOW);
    manager.submit(pairingRequest(offer), NOW + 1);
    const approval = manager.approve(offer.pairingId, NOW + 2);
    if (!approval.ok) throw new Error('Expected pairing approval');

    const tampered = {
      ...approval.receipt,
      permissions: [...approval.receipt.permissions, 'session:prompt:send'],
    };
    expect(verifyPairingReceipt(tampered, bridgePublicKeySpki, BRIDGE_ID)).toBe(false);
    expect(verifyPairingReceipt(approval.receipt, bridgePublicKeySpki, 'bridge_0987654321')).toBe(
      false,
    );
  });

  it('supports explicit permission updates and revocation', () => {
    const offer = manager.createOffer(NOW);
    manager.submit(pairingRequest(offer), NOW + 1);
    const approval = manager.approve(offer.pairingId, NOW + 2);
    if (!approval.ok) throw new Error('Expected pairing approval');

    const updated = updateDevicePermissions(approval.device, {
      permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
      allowedSessionIds: ['approved-session'],
    });
    expect(updated).toMatchObject({
      permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
      allowedSessionIds: ['approved-session'],
    });
    expect(revokeDeviceRecord(updated).status).toBe('revoked');
  });

  it('rejects duplicate permission or session-scope updates', () => {
    const offer = manager.createOffer(NOW);
    manager.submit(pairingRequest(offer), NOW + 1);
    const approval = manager.approve(offer.pairingId, NOW + 2);
    if (!approval.ok) throw new Error('Expected pairing approval');

    expect(() =>
      updateDevicePermissions(approval.device, {
        permissions: ['bridge:health', 'bridge:health'],
      }),
    ).toThrow();
    expect(() =>
      updateDevicePermissions(approval.device, {
        permissions: ['bridge:health'],
        allowedSessionIds: ['same-session', 'same-session'],
      }),
    ).toThrow();
  });

  it('rejects mismatched bridge identity keys', () => {
    const otherKey = generateKeyPairSync('ed25519').publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64url');

    expect(
      () =>
        new PairingManager({
          bridgeId: BRIDGE_ID,
          privateKey: bridgeKeys.privateKey,
          publicKeySpki: otherKey,
        }, registry),
    ).toThrow('keys do not match');
  });
});
