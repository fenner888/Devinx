import { isAbsolute } from 'node:path';
import { isIP } from 'node:net';

import { z } from 'zod';

import {
  AcpSessionClient,
  isAcpSessionInUseError,
  type AcpHistoryMessage,
} from './acp';
import { DevinSessionStore } from './devin-session-store';
import type { HttpsBridgeListenerAddress, HttpsBridgeListenerOptions } from './listener';
import { HttpsBridgeListener } from './listener';
import { MacOSKeychainSecretStore } from './macos-keychain';
import {
  isAdvertisablePrivateAddress,
  privateTransportKind,
  type PrivateTransportKind,
} from './network';
import { PairingManager, type PairingApprovalOptions, type PendingPairingReview } from './pairing';
import { FixedWindowRateLimiter } from './rate-limit';
import { InMemoryReplayGuard } from './replay';
import { BridgeService, type SessionDiscoveryAdapter } from './service';
import { SessionHandleRegistry } from './session-handles';
import type { SecretStore } from './secret-store';
import {
  DesktopBridgeStateRepository,
  loadDesktopBridgeRuntime,
  type DeviceSummary,
  type PersistentDeviceRegistry,
} from './state';
import {
  OpenSslTlsIdentityGenerator,
  type TlsIdentity,
  type TlsIdentityGenerator,
} from './tls-identity';

const runnerOptionsSchema = z
  .object({
    advertisedHost: z
      .string()
      .min(2)
      .max(64)
      .refine(
        isAdvertisablePrivateAddress,
        'Advertised host must be an advertisable private IP address',
      ),
    bindHost: z
      .string()
      .refine((value) => isIP(value) !== 0, 'Bind host must be an IP literal')
      .optional(),
    port: z.number().int().min(1_024).max(65_535).default(45_831),
    bindPort: z.number().int().min(1_024).max(65_535).optional(),
    devinCliPath: z
      .string()
      .min(1)
      .max(4_096)
      .refine(isAbsolute, 'Devin CLI path must be absolute')
      .optional(),
    devinSessionDbPath: z
      .string()
      .min(1)
      .max(4_096)
      .refine(isAbsolute, 'Devin session database path must be absolute')
      .optional(),
  })
  .strict();

export interface DesktopBridgeRunnerOptions {
  advertisedHost: string;
  bindHost?: string;
  port?: number;
  bindPort?: number;
  devinCliPath?: string;
  devinSessionDbPath?: string;
}

export interface PairingQrRenderer {
  render(payload: string): void;
}

export interface BridgeListenerLifecycle {
  start(): Promise<HttpsBridgeListenerAddress>;
  stop(): Promise<void>;
}

export interface AcpSessionLifecycle extends SessionDiscoveryAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  createContinuation?(cwd: string, context: string, text: string): Promise<string>;
}

export interface SessionHistoryLifecycle {
  start(): Promise<void>;
  stop(): Promise<void>;
  isSessionLoadSupported(): boolean;
  loadSession(sessionId: string): ReturnType<SessionDiscoveryAdapter['loadSession']>;
}

export interface DesktopBridgeRunnerDependencies {
  secretStore: SecretStore;
  tlsIdentityGenerator: TlsIdentityGenerator;
  qrRenderer: PairingQrRenderer;
  createListener(options: HttpsBridgeListenerOptions): BridgeListenerLifecycle;
  createAcpClient(executablePath: string): AcpSessionLifecycle;
  createSessionStore?(databasePath: string): SessionHistoryLifecycle;
  onPairingDiagnostic?: HttpsBridgeListenerOptions['onPairingDiagnostic'];
}

export interface StartedDesktopBridge {
  endpoint: string;
  pairingOfferExpiresAt: number;
  sessionDiscoveryEnabled: boolean;
  transportKind: PrivateTransportKind;
}

const unavailableSessions: SessionDiscoveryAdapter = {
  isSessionListSupported: () => false,
  listSessions: () => Promise.reject(new Error('Session discovery is not enabled')),
  isSessionLoadSupported: () => false,
  loadSession: () => Promise.reject(new Error('Session loading is not enabled')),
  isSessionPromptSupported: () => false,
  promptSession: () => Promise.reject(new Error('Session prompting is not enabled')),
};

const MAXIMUM_REHYDRATION_PAGES = 100;
// Reserve one KiB for the omission marker and framing before ACP's 160 KiB limit.
const MAXIMUM_CONTINUATION_CONTEXT_BYTES = 149 * 1024;

function continuationContext(messages: AcpHistoryMessage[], truncated: boolean): string {
  const blocks: string[] = [];
  let omitted = truncated;
  const base = [
    '# Prior Devin conversation',
    '',
    'This is a read-only transcript supplied to continue the conversation in a new session.',
  ]
    .join('\n');
  let bytes = Buffer.byteLength(base, 'utf8');
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    const speaker = message.source === 'user' ? 'User' : 'Devin';
    const block = `## ${speaker}\n\n${message.text}`;
    const blockBytes = Buffer.byteLength(`\n\n${block}`, 'utf8');
    if (bytes + blockBytes > MAXIMUM_CONTINUATION_CONTEXT_BYTES) {
      omitted = true;
      break;
    }
    blocks.unshift(block);
    bytes += blockBytes;
  }
  const omission = omitted ? '\n\nThe oldest transcript content was omitted.' : '';
  return `${base}${omission}\n\n${blocks.join('\n\n')}`;
}

export class RecoverableSessionDiscoveryAdapter implements SessionDiscoveryAdapter {
  private current: SessionDiscoveryAdapter = unavailableSessions;
  private history: SessionHistoryLifecycle | null = null;
  private readonly listedSessionIds = new Set<string>();
  private readonly acpLoadedSessionIds = new Set<string>();

  replace(adapter: SessionDiscoveryAdapter | null): void {
    this.current = adapter ?? unavailableSessions;
    this.listedSessionIds.clear();
    this.acpLoadedSessionIds.clear();
  }

  setHistory(adapter: SessionHistoryLifecycle | null): void {
    this.history = adapter;
  }

  isSessionListSupported(): boolean {
    return this.current.isSessionListSupported();
  }

  async listSessions(input?: unknown): ReturnType<SessionDiscoveryAdapter['listSessions']> {
    const page = await this.current.listSessions(input);
    for (const session of page.sessions) this.listedSessionIds.add(session.sessionId);
    return page;
  }

  isSessionLoadSupported(): boolean {
    return Boolean(this.history?.isSessionLoadSupported()) || this.current.isSessionLoadSupported();
  }

  async loadSession(input: string): ReturnType<SessionDiscoveryAdapter['loadSession']> {
    await this.ensureSessionListed(input);
    if (this.history?.isSessionLoadSupported()) {
      try {
        return await this.history.loadSession(input);
      } catch {
        // Fall back to negotiated ACP loading when the reviewed store cannot
        // provide this specific session without exposing its private error.
      }
    }
    const loaded = await this.current.loadSession(input);
    this.acpLoadedSessionIds.add(input);
    return loaded;
  }

  isSessionPromptSupported(): boolean {
    return this.current.isSessionPromptSupported();
  }

  async promptSession(
    sessionId: string,
    text: string,
  ): ReturnType<SessionDiscoveryAdapter['promptSession']> {
    await this.ensureSessionListed(sessionId);
    if (!this.acpLoadedSessionIds.has(sessionId)) {
      try {
        await this.current.loadSession(sessionId);
        this.acpLoadedSessionIds.add(sessionId);
      } catch (error) {
        const createContinuation = this.current.createContinuation;
        if (
          !isAcpSessionInUseError(error) ||
          !createContinuation ||
          !this.history?.isSessionLoadSupported()
        ) {
          throw error;
        }
        const history = await this.history.loadSession(sessionId);
        if (history.messages.length === 0) throw new Error('Session continuation has no context');
        const continuedSessionId = await createContinuation.call(
          this.current,
          history.cwd,
          continuationContext(history.messages, history.truncated),
          text,
        );
        this.listedSessionIds.add(continuedSessionId);
        this.acpLoadedSessionIds.add(continuedSessionId);
        return { continuedSessionId };
      }
    }
    return this.current.promptSession(sessionId, text);
  }

  private async ensureSessionListed(sessionId: string): Promise<void> {
    if (this.listedSessionIds.has(sessionId)) return;
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < MAXIMUM_REHYDRATION_PAGES; pageIndex += 1) {
      const page = await this.listSessions(cursor ? { cursor } : {});
      if (this.listedSessionIds.has(sessionId)) return;
      cursor = page.nextCursor;
      if (!cursor || seenCursors.has(cursor)) break;
      seenCursors.add(cursor);
    }
    throw new Error('Session is not available in the current ACP process');
  }
}

export function createProductionRunnerDependencies(
  qrRenderer: PairingQrRenderer,
): DesktopBridgeRunnerDependencies {
  return {
    secretStore: new MacOSKeychainSecretStore(),
    tlsIdentityGenerator: new OpenSslTlsIdentityGenerator(),
    qrRenderer,
    createListener: (options) => new HttpsBridgeListener(options),
    createAcpClient: (executablePath) => new AcpSessionClient({ executablePath }),
    createSessionStore: (databasePath) => new DevinSessionStore({ databasePath }),
  };
}

export class DesktopBridgeRunner {
  private listener: BridgeListenerLifecycle | null = null;
  private acp: AcpSessionLifecycle | null = null;
  private history: SessionHistoryLifecycle | null = null;
  private readonly sessions = new RecoverableSessionDiscoveryAdapter();
  private acpRecovery: Promise<boolean> | null = null;
  private devinCliPath: string | null = null;
  private pairing: PairingManager | null = null;
  private sessionHandles: SessionHandleRegistry | null = null;
  private devices: PersistentDeviceRegistry | null = null;
  private transport: {
    transportSecurity: 'tailscale_wireguard' | 'pinned_tls';
    bridgeEndpoint: string;
    tlsCertificateFingerprint: string;
  } | null = null;
  private started = false;
  private stopped = false;

  constructor(
    private readonly optionsInput: DesktopBridgeRunnerOptions,
    private readonly dependencies: DesktopBridgeRunnerDependencies,
  ) {}

  async start(): Promise<StartedDesktopBridge> {
    if (this.started || this.stopped) throw new Error('Desktop Bridge runner cannot restart');
    const options = runnerOptionsSchema.parse(this.optionsInput);
    this.started = true;

    try {
      const repository = new DesktopBridgeStateRepository(this.dependencies.secretStore);
      const runtime = await loadDesktopBridgeRuntime(repository);
      let sessionHandles: SessionHandleRegistry;
      let tlsIdentity: TlsIdentity;
      try {
        tlsIdentity = await runtime.devices.ensureTlsIdentity(
          this.dependencies.tlsIdentityGenerator,
        );
        sessionHandles = new SessionHandleRegistry(runtime.bridgeId, runtime.sessionHandleKey);
      } finally {
        runtime.sessionHandleKey.fill(0);
      }
      this.sessionHandles = sessionHandles;
      this.devices = runtime.devices;

      let sessions: SessionDiscoveryAdapter = unavailableSessions;
      if (options.devinCliPath) {
        this.devinCliPath = options.devinCliPath;
        const acp = this.dependencies.createAcpClient(options.devinCliPath);
        this.acp = acp;
        await acp.start();
        this.sessions.replace(acp);
        sessions = this.sessions;
        if (options.devinSessionDbPath && this.dependencies.createSessionStore) {
          const history = this.dependencies.createSessionStore(options.devinSessionDbPath);
          try {
            await history.start();
            this.history = history;
            this.sessions.setHistory(history);
          } catch {
            await history.stop().catch(() => {});
          }
        }
      }

      const pairing = new PairingManager(runtime.identity, runtime.devices);
      this.pairing = pairing;
      const service = new BridgeService({
        bridgeId: runtime.bridgeId,
        devices: runtime.devices,
        replayGuard: new InMemoryReplayGuard(),
        rateLimiter: new FixedWindowRateLimiter(),
        sessionHandles,
        sessions,
      });
      const listener = this.dependencies.createListener({
        service,
        pairing,
        tlsCertificatePem: tlsIdentity.certificatePem,
        tlsPrivateKeyPem: tlsIdentity.privateKeyPem,
        host: options.bindHost ?? options.advertisedHost,
        port: options.bindPort ?? options.port,
        advertisedPort: options.port,
        allowLan: options.bindHost === undefined,
        allowedHosts: [options.advertisedHost],
        transportSecurity:
          privateTransportKind(options.advertisedHost) === 'tailscale_vpn'
            ? 'tailscale_wireguard'
            : 'pinned_tls',
        onPairingDiagnostic: this.dependencies.onPairingDiagnostic,
      });
      this.listener = listener;
      const address = await listener.start();
      if (address.certificateFingerprint !== tlsIdentity.certificateFingerprint) {
        throw new Error('Desktop Bridge listener TLS identity changed unexpectedly');
      }
      const endpointHost =
        isIP(options.advertisedHost) === 6 ? `[${options.advertisedHost}]` : options.advertisedHost;
      const transportSecurity =
        privateTransportKind(options.advertisedHost) === 'tailscale_vpn'
          ? 'tailscale_wireguard'
          : 'pinned_tls';
      const endpoint = `${transportSecurity === 'tailscale_wireguard' ? 'http' : 'https'}://${endpointHost}:${options.port}/`;
      this.transport = {
        transportSecurity,
        bridgeEndpoint: endpoint,
        tlsCertificateFingerprint: address.certificateFingerprint,
      };
      const pairingOfferExpiresAt = this.showPairingOffer();
      return {
        endpoint,
        pairingOfferExpiresAt,
        sessionDiscoveryEnabled: sessions.isSessionListSupported(),
        transportKind: privateTransportKind(options.advertisedHost),
      };
    } catch (error) {
      await this.stopAfterFailure();
      throw error;
    }
  }

  showPairingOffer(now = Date.now()): number {
    if (!this.pairing || !this.transport || this.stopped) {
      throw new Error('Desktop Bridge runner is not active');
    }
    const offer = this.pairing.createOffer(this.transport, now);
    // Do not retain or log this one-time payload; JavaScript strings cannot be reliably zeroed.
    this.dependencies.qrRenderer.render(JSON.stringify(offer));
    return offer.expiresAt;
  }

  pendingReviews(now = Date.now()): PendingPairingReview[] {
    if (!this.pairing || this.stopped) return [];
    return this.pairing.pendingReviews(now);
  }

  async approve(
    pairingId: string,
    options: PairingApprovalOptions = {},
    now = Date.now(),
  ): Promise<boolean> {
    if (!this.pairing || this.stopped) return false;
    return (await this.pairing.approve(pairingId, now, options)).ok;
  }

  deny(pairingId: string): boolean {
    if (!this.pairing || this.stopped) return false;
    return this.pairing.deny(pairingId);
  }

  pairedDevices(): DeviceSummary[] {
    return this.devices?.list() ?? [];
  }

  async updateDevicePermissions(
    deviceId: string,
    options: { allowSessionContent: boolean; allowSessionPrompt: boolean },
  ): Promise<boolean> {
    const devices = this.devices;
    if (!devices || this.stopped) return false;
    const current = devices.get(deviceId) as DeviceSummary | undefined;
    if (!current || current.status !== 'active') return false;
    return devices.updatePermissions(deviceId, {
      permissions: [
        'bridge:health',
        'session:metadata:read',
        ...(options.allowSessionContent ? (['session:content:read'] as const) : []),
        ...(options.allowSessionPrompt ? (['session:prompt:send'] as const) : []),
      ],
    });
  }

  async revokeDevice(deviceId: string): Promise<boolean> {
    if (!this.devices || this.stopped) return false;
    return this.devices.revoke(deviceId);
  }

  async recoverSessionDiscovery(): Promise<boolean> {
    const executablePath = this.devinCliPath;
    if (!executablePath || this.stopped || !this.started) return false;
    const current = this.acp;
    if (
      current &&
      (current.isSessionListSupported() ||
        current.isSessionLoadSupported() ||
        current.isSessionPromptSupported())
    ) {
      return current.isSessionListSupported();
    }
    if (this.acpRecovery) return this.acpRecovery;

    const recovery = (async () => {
      this.acp = null;
      this.sessions.replace(null);
      await current?.stop().catch(() => {});
      if (this.stopped) return false;

      const replacement = this.dependencies.createAcpClient(executablePath);
      try {
        await replacement.start();
        if (this.stopped) {
          await replacement.stop().catch(() => {});
          return false;
        }
        this.acp = replacement;
        this.sessions.replace(replacement);
        return replacement.isSessionListSupported();
      } catch {
        await replacement.stop().catch(() => {});
        return false;
      }
    })();
    this.acpRecovery = recovery;
    try {
      return await recovery;
    } finally {
      if (this.acpRecovery === recovery) this.acpRecovery = null;
    }
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    const recovery = this.acpRecovery;
    if (recovery) await recovery.catch(() => false);
    const listener = this.listener;
    const acp = this.acp;
    const history = this.history;
    const sessionHandles = this.sessionHandles;
    this.listener = null;
    this.acp = null;
    this.history = null;
    this.sessions.replace(null);
    this.sessions.setHistory(null);
    this.devinCliPath = null;
    this.pairing = null;
    this.sessionHandles = null;
    this.devices = null;
    this.transport = null;

    const results = await Promise.allSettled([
      listener?.stop() ?? Promise.resolve(),
      acp?.stop() ?? Promise.resolve(),
      history?.stop() ?? Promise.resolve(),
    ]);
    sessionHandles?.destroy();
    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('Desktop Bridge did not shut down cleanly');
    }
  }

  private async stopAfterFailure(): Promise<void> {
    try {
      await this.stop();
    } catch {
      // Preserve the startup error while still attempting every secure cleanup path.
    }
  }
}
