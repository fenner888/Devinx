import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';

import { z } from 'zod';

import type { KeychainSecretStore } from './macos-keychain';
import {
  devicePermissionUpdateSchema,
  revokeDeviceRecord,
  updateDevicePermissions,
  type BridgePairingIdentity,
  type DevicePermissionUpdate,
  type PairingDeviceRegistry,
} from './pairing';
import { deviceRecordSchema, opaqueIdSchema, type DeviceRecord } from './schemas';

const base64UrlSchema = z
  .string()
  .min(32)
  .max(4096)
  .regex(/^[A-Za-z0-9_-]+$/);

const bridgeStateSchema = z
  .object({
    version: z.literal(1),
    bridgeId: opaqueIdSchema,
    privateKeyPkcs8: base64UrlSchema,
    publicKeySpki: base64UrlSchema,
    sessionHandleKey: base64UrlSchema.length(43),
    devices: z.array(deviceRecordSchema).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const deviceIds = value.devices.map((device) => device.deviceId);
    if (new Set(deviceIds).size !== deviceIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Device IDs must be unique' });
    }
    if (value.devices.some((device) => device.bridgeId !== value.bridgeId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Device bridge IDs must match' });
    }
  });

export type DesktopBridgeState = z.infer<typeof bridgeStateSchema>;

export interface DeviceSummary {
  deviceId: string;
  deviceName: string;
  pairedAt: number;
  status: DeviceRecord['status'];
  permissions: DeviceRecord['permissions'];
  allowedSessionIds?: string[];
}

export interface DesktopBridgeRuntimeState {
  bridgeId: string;
  identity: BridgePairingIdentity;
  sessionHandleKey: Buffer;
  devices: PersistentDeviceRegistry;
}

function cloneDevice(device: DeviceRecord): DeviceRecord {
  return {
    ...device,
    permissions: [...device.permissions],
    allowedSessionIds: device.allowedSessionIds ? [...device.allowedSessionIds] : undefined,
  };
}

function cloneState(state: DesktopBridgeState): DesktopBridgeState {
  return { ...state, devices: state.devices.map(cloneDevice) };
}

function identityKeys(state: DesktopBridgeState): { privateKey: KeyObject; publicKey: KeyObject } {
  const privateKeyBytes = Buffer.from(state.privateKeyPkcs8, 'base64url');
  const publicKeyBytes = Buffer.from(state.publicKeySpki, 'base64url');
  const sessionHandleKeyBytes = Buffer.from(state.sessionHandleKey, 'base64url');
  try {
    const privateKey = createPrivateKey({
      key: privateKeyBytes,
      format: 'der',
      type: 'pkcs8',
    });
    const publicKey = createPublicKey({
      key: publicKeyBytes,
      format: 'der',
      type: 'spki',
    });
    if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519') {
      throw new Error('Unexpected bridge key type');
    }
    const check = Buffer.from('devinx-state-identity-check', 'utf8');
    if (!verify(null, check, publicKey, sign(null, check, privateKey))) {
      throw new Error('Bridge identity keys do not match');
    }
    if (sessionHandleKeyBytes.length !== 32) {
      throw new Error('Session handle key is invalid');
    }
    return { privateKey, publicKey };
  } catch {
    throw new Error('Desktop Bridge state failed cryptographic validation');
  } finally {
    privateKeyBytes.fill(0);
    publicKeyBytes.fill(0);
    sessionHandleKeyBytes.fill(0);
  }
}

function parseState(input: unknown): DesktopBridgeState {
  const result = bridgeStateSchema.safeParse(input);
  if (!result.success) throw new Error('Desktop Bridge state failed validation');
  identityKeys(result.data);
  return result.data;
}

function createState(): DesktopBridgeState {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyBytes = privateKey.export({ format: 'der', type: 'pkcs8' });
  const publicKeyBytes = publicKey.export({ format: 'der', type: 'spki' });
  const sessionHandleKeyBytes = randomBytes(32);
  try {
    return parseState({
      version: 1,
      bridgeId: `bridge_${randomBytes(18).toString('base64url')}`,
      privateKeyPkcs8: privateKeyBytes.toString('base64url'),
      publicKeySpki: publicKeyBytes.toString('base64url'),
      sessionHandleKey: sessionHandleKeyBytes.toString('base64url'),
      devices: [],
    });
  } finally {
    privateKeyBytes.fill(0);
    publicKeyBytes.fill(0);
    sessionHandleKeyBytes.fill(0);
  }
}

export class DesktopBridgeStateRepository {
  constructor(private readonly secrets: KeychainSecretStore) {}

  async loadOrCreate(): Promise<DesktopBridgeState> {
    const stored = await this.secrets.get();
    if (!stored) {
      const created = createState();
      await this.save(created);
      return cloneState(created);
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(stored);
    } catch {
      throw new Error('Desktop Bridge state is corrupted');
    }
    return cloneState(parseState(decoded));
  }

  async save(input: unknown): Promise<void> {
    const state = parseState(input);
    await this.secrets.set(JSON.stringify(state));
  }

  async reset(): Promise<void> {
    await this.secrets.delete();
  }
}

export class PersistentDeviceRegistry implements PairingDeviceRegistry {
  private state: DesktopBridgeState;
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly repository: DesktopBridgeStateRepository,
    state: DesktopBridgeState,
  ) {
    this.state = cloneState(state);
  }

  static async open(repository: DesktopBridgeStateRepository): Promise<PersistentDeviceRegistry> {
    return new PersistentDeviceRegistry(repository, await repository.loadOrCreate());
  }

  get(deviceId: string): unknown {
    const device = this.state.devices.find((candidate) => candidate.deviceId === deviceId);
    return device ? cloneDevice(device) : undefined;
  }

  list(): DeviceSummary[] {
    return this.state.devices.map((device) => ({
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      pairedAt: device.pairedAt,
      status: device.status,
      permissions: [...device.permissions],
      allowedSessionIds: device.allowedSessionIds ? [...device.allowedSessionIds] : undefined,
    }));
  }

  register(input: DeviceRecord): Promise<boolean> {
    return this.enqueue(async () => {
      const device = deviceRecordSchema.parse(input);
      if (
        device.bridgeId !== this.state.bridgeId ||
        this.state.devices.some((candidate) => candidate.deviceId === device.deviceId)
      ) {
        return false;
      }
      await this.commit({ ...this.state, devices: [...this.state.devices, cloneDevice(device)] });
      return true;
    });
  }

  updatePermissions(deviceId: string, input: unknown): Promise<boolean> {
    return this.enqueue(async () => {
      const update: DevicePermissionUpdate = devicePermissionUpdateSchema.parse(input);
      const index = this.state.devices.findIndex((device) => device.deviceId === deviceId);
      const current = this.state.devices[index];
      if (!current) return false;
      const updated = updateDevicePermissions(current, update);
      const devices = this.state.devices.map((device, candidateIndex) =>
        candidateIndex === index ? updated : device,
      );
      await this.commit({ ...this.state, devices });
      return true;
    });
  }

  revoke(deviceId: string): Promise<boolean> {
    return this.enqueue(async () => {
      const index = this.state.devices.findIndex((device) => device.deviceId === deviceId);
      const current = this.state.devices[index];
      if (!current) return false;
      const revoked = revokeDeviceRecord(current);
      const devices = this.state.devices.map((device, candidateIndex) =>
        candidateIndex === index ? revoked : device,
      );
      await this.commit({ ...this.state, devices });
      return true;
    });
  }

  bridgeState(): DesktopBridgeState {
    return cloneState(this.state);
  }

  private async commit(nextState: DesktopBridgeState): Promise<void> {
    await this.repository.save(nextState);
    this.state = cloneState(nextState);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export async function loadDesktopBridgeRuntime(
  repository: DesktopBridgeStateRepository,
): Promise<DesktopBridgeRuntimeState> {
  const devices = await PersistentDeviceRegistry.open(repository);
  const state = devices.bridgeState();
  const keys = identityKeys(state);
  return {
    bridgeId: state.bridgeId,
    identity: {
      bridgeId: state.bridgeId,
      privateKey: keys.privateKey,
      publicKeySpki: state.publicKeySpki,
    },
    sessionHandleKey: Buffer.from(state.sessionHandleKey, 'base64url'),
    devices,
  };
}
