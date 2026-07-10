import { generateKeyPairSync } from 'node:crypto';

import type { KeychainSecretStore } from '../../bridge/src/macos-keychain';
import {
  PairingManager,
  createPairingProof,
  type UnsignedPairingRequest,
} from '../../bridge/src/pairing';
import {
  DesktopBridgeStateRepository,
  PersistentDeviceRegistry,
  loadDesktopBridgeRuntime,
} from '../../bridge/src/state';
import { BRIDGE_PROTOCOL_VERSION, type DeviceRecord } from '../../bridge/src/schemas';
import { OpenSslTlsIdentityGenerator } from '../../bridge/src/tls-identity';

const NOW = 1_800_000_000_000;
const TRANSPORT = {
  bridgeEndpoint: 'https://192.168.1.20:45831/',
  tlsCertificateFingerprint: 'T'.repeat(43),
};

class MemorySecretStore implements KeychainSecretStore {
  value: string | null = null;
  failWrites = false;

  async get(): Promise<string | null> {
    return this.value;
  }

  async set(value: string): Promise<void> {
    if (this.failWrites) throw new Error('simulated Keychain failure');
    this.value = value;
  }

  async delete(): Promise<void> {
    this.value = null;
  }
}

function deviceRecord(bridgeId: string, deviceId = 'device_1234567890'): DeviceRecord {
  const publicKeySpki = generateKeyPairSync('ed25519')
    .publicKey.export({ format: 'der', type: 'spki' })
    .toString('base64url');
  return {
    bridgeId,
    deviceId,
    deviceName: 'Frank’s iPhone',
    publicKeySpki,
    status: 'active',
    pairedAt: NOW,
    permissions: ['bridge:health', 'session:metadata:read'],
  };
}

describe('Desktop Bridge Keychain state', () => {
  it('creates a cryptographically valid identity once and reloads it unchanged', async () => {
    const secrets = new MemorySecretStore();
    const repository = new DesktopBridgeStateRepository(secrets);

    const first = await repository.loadOrCreate();
    const second = await repository.loadOrCreate();

    expect(first.bridgeId).toMatch(/^bridge_[A-Za-z0-9_-]{24}$/);
    expect(first.version).toBe(2);
    expect(Buffer.from(first.sessionHandleKey, 'base64url')).toHaveLength(32);
    expect(second).toEqual(first);
    expect(secrets.value).not.toBeNull();
  });

  it('migrates legacy version 1 state without rotating cryptographic identity', async () => {
    const secrets = new MemorySecretStore();
    const repository = new DesktopBridgeStateRepository(secrets);
    const current = await repository.loadOrCreate();
    secrets.value = JSON.stringify({
      version: 1,
      bridgeId: current.bridgeId,
      privateKeyPkcs8: current.privateKeyPkcs8,
      publicKeySpki: current.publicKeySpki,
      sessionHandleKey: current.sessionHandleKey,
      devices: current.devices,
    });

    const migrated = await repository.loadOrCreate();

    expect(migrated).toMatchObject({
      version: 2,
      bridgeId: current.bridgeId,
      privateKeyPkcs8: current.privateKeyPkcs8,
      publicKeySpki: current.publicKeySpki,
      sessionHandleKey: current.sessionHandleKey,
    });
    expect(JSON.parse(secrets.value ?? '{}')).toMatchObject({ version: 2 });
  });

  it('fails closed on corrupt JSON or mismatched identity keys', async () => {
    const secrets = new MemorySecretStore();
    const repository = new DesktopBridgeStateRepository(secrets);
    secrets.value = '{invalid-json';
    await expect(repository.loadOrCreate()).rejects.toThrow('corrupted');

    const valid = await new DesktopBridgeStateRepository(new MemorySecretStore()).loadOrCreate();
    const otherPublicKey = generateKeyPairSync('ed25519')
      .publicKey.export({ format: 'der', type: 'spki' })
      .toString('base64url');
    secrets.value = JSON.stringify({ ...valid, publicKeySpki: otherPublicKey });
    await expect(repository.loadOrCreate()).rejects.toThrow('cryptographic validation');
  });

  it('serializes duplicate registration and persists permission/revocation changes', async () => {
    const secrets = new MemorySecretStore();
    const repository = new DesktopBridgeStateRepository(secrets);
    const registry = await PersistentDeviceRegistry.open(repository);
    const record = deviceRecord(registry.bridgeState().bridgeId);

    const registrations = await Promise.all([registry.register(record), registry.register(record)]);
    expect(registrations.sort()).toEqual([false, true]);
    const returned = registry.get(record.deviceId) as DeviceRecord;
    returned.permissions.push('session:content:read');
    expect((registry.get(record.deviceId) as DeviceRecord).permissions).toEqual([
      'bridge:health',
      'session:metadata:read',
    ]);

    await expect(
      registry.updatePermissions(record.deviceId, {
        permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
        allowedSessionIds: ['local_approved'],
      }),
    ).resolves.toBe(true);
    await expect(registry.revoke(record.deviceId)).resolves.toBe(true);

    const reloaded = await PersistentDeviceRegistry.open(repository);
    expect(reloaded.get(record.deviceId)).toMatchObject({
      status: 'revoked',
      permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
      allowedSessionIds: ['local_approved'],
    });
  });

  it('does not mutate in-memory authorization state when persistence fails', async () => {
    const secrets = new MemorySecretStore();
    const registry = await PersistentDeviceRegistry.open(new DesktopBridgeStateRepository(secrets));
    const record = deviceRecord(registry.bridgeState().bridgeId);
    secrets.failWrites = true;

    await expect(registry.register(record)).rejects.toThrow('simulated Keychain failure');
    expect(registry.get(record.deviceId)).toBeUndefined();
  });

  it('persists one validated TLS identity and reuses it without silent rotation', async () => {
    const secrets = new MemorySecretStore();
    const registry = await PersistentDeviceRegistry.open(new DesktopBridgeStateRepository(secrets));
    const generator = new OpenSslTlsIdentityGenerator({ validityDays: 1 });
    const generate = jest.spyOn(generator, 'generate');

    const first = await registry.ensureTlsIdentity(generator);
    const second = await registry.ensureTlsIdentity(generator);
    const reloaded = await PersistentDeviceRegistry.open(new DesktopBridgeStateRepository(secrets));

    expect(generate).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(reloaded.getTlsIdentity()).toEqual(first);
    expect(secrets.value).toContain('BEGIN PRIVATE KEY');
  });

  it('replaces only an expired TLS identity and persists the replacement', async () => {
    const secrets = new MemorySecretStore();
    const registry = await PersistentDeviceRegistry.open(new DesktopBridgeStateRepository(secrets));
    const shortLived = new OpenSslTlsIdentityGenerator({ validityDays: 1 });
    const replacementGenerator = new OpenSslTlsIdentityGenerator({ validityDays: 365 });
    const replacementGenerate = jest.spyOn(replacementGenerator, 'generate');
    const first = await registry.ensureTlsIdentity(shortLived);

    const replacement = await registry.ensureTlsIdentity(replacementGenerator, first.validTo + 1);
    const reloaded = await PersistentDeviceRegistry.open(new DesktopBridgeStateRepository(secrets));

    expect(replacementGenerate).toHaveBeenCalledTimes(1);
    expect(replacement.certificateFingerprint).not.toBe(first.certificateFingerprint);
    expect(reloaded.getTlsIdentity()).toEqual(replacement);
  });

  it('persists an approved pairing atomically through the device registry', async () => {
    const secrets = new MemorySecretStore();
    const repository = new DesktopBridgeStateRepository(secrets);
    const runtime = await loadDesktopBridgeRuntime(repository);
    const manager = new PairingManager(runtime.identity, runtime.devices);
    const phoneKeys = generateKeyPairSync('ed25519');
    const offer = manager.createOffer(TRANSPORT, NOW);
    const unsigned: UnsignedPairingRequest = {
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      bridgeId: offer.bridgeId,
      pairingId: offer.pairingId,
      bridgeKeyFingerprint: offer.bridgeKeyFingerprint,
      bridgeEndpoint: offer.bridgeEndpoint,
      tlsCertificateFingerprint: offer.tlsCertificateFingerprint,
      deviceId: 'device_1234567890',
      deviceName: 'Frank’s iPhone',
      devicePublicKeySpki: phoneKeys.publicKey
        .export({ format: 'der', type: 'spki' })
        .toString('base64url'),
    };
    manager.submit(
      { ...unsigned, proof: createPairingProof(offer.pairingSecret, unsigned) },
      NOW + 1,
    );

    const approval = await manager.approve(offer.pairingId, NOW + 2);
    expect(approval.ok).toBe(true);
    const reloaded = await PersistentDeviceRegistry.open(repository);
    expect(reloaded.get(unsigned.deviceId)).toMatchObject({
      deviceName: 'Frank’s iPhone',
      permissions: ['bridge:health', 'session:metadata:read'],
    });
    runtime.sessionHandleKey.fill(0);
  });
});
