import { isAbsolute } from 'node:path';

import { z } from 'zod';

import { AcpSessionClient } from './acp';
import type { HttpsBridgeListenerAddress, HttpsBridgeListenerOptions } from './listener';
import { HttpsBridgeListener } from './listener';
import type { KeychainSecretStore } from './macos-keychain';
import { MacOSKeychainSecretStore } from './macos-keychain';
import { isPrivateLanIPv4 } from './network';
import { PairingManager, type PendingPairingReview } from './pairing';
import { FixedWindowRateLimiter } from './rate-limit';
import { InMemoryReplayGuard } from './replay';
import { BridgeService, type SessionDiscoveryAdapter } from './service';
import { SessionHandleRegistry } from './session-handles';
import { DesktopBridgeStateRepository, loadDesktopBridgeRuntime } from './state';
import {
  OpenSslTlsIdentityGenerator,
  type TlsIdentity,
  type TlsIdentityGenerator,
} from './tls-identity';

const runnerOptionsSchema = z
  .object({
    advertisedHost: z
      .string()
      .min(7)
      .max(15)
      .refine(isPrivateLanIPv4, 'Advertised host must be a private LAN IPv4 address'),
    port: z.number().int().min(1_024).max(65_535).default(45_831),
    devinCliPath: z
      .string()
      .min(1)
      .max(4_096)
      .refine(isAbsolute, 'Devin CLI path must be absolute')
      .optional(),
  })
  .strict();

export interface DesktopBridgeRunnerOptions {
  advertisedHost: string;
  port?: number;
  devinCliPath?: string;
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
}

export interface DesktopBridgeRunnerDependencies {
  secretStore: KeychainSecretStore;
  tlsIdentityGenerator: TlsIdentityGenerator;
  qrRenderer: PairingQrRenderer;
  createListener(options: HttpsBridgeListenerOptions): BridgeListenerLifecycle;
  createAcpClient(executablePath: string): AcpSessionLifecycle;
}

export interface StartedDesktopBridge {
  endpoint: string;
  pairingOfferExpiresAt: number;
  sessionDiscoveryEnabled: boolean;
}

const unavailableSessions: SessionDiscoveryAdapter = {
  isSessionListSupported: () => false,
  listSessions: () => Promise.reject(new Error('Session discovery is not enabled')),
  isSessionLoadSupported: () => false,
  loadSession: () => Promise.reject(new Error('Session loading is not enabled')),
};

export function createProductionRunnerDependencies(
  qrRenderer: PairingQrRenderer,
): DesktopBridgeRunnerDependencies {
  return {
    secretStore: new MacOSKeychainSecretStore(),
    tlsIdentityGenerator: new OpenSslTlsIdentityGenerator(),
    qrRenderer,
    createListener: (options) => new HttpsBridgeListener(options),
    createAcpClient: (executablePath) => new AcpSessionClient({ executablePath }),
  };
}

export class DesktopBridgeRunner {
  private listener: BridgeListenerLifecycle | null = null;
  private acp: AcpSessionLifecycle | null = null;
  private pairing: PairingManager | null = null;
  private sessionHandles: SessionHandleRegistry | null = null;
  private transport: { bridgeEndpoint: string; tlsCertificateFingerprint: string } | null = null;
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
        sessionHandles = new SessionHandleRegistry(
          runtime.bridgeId,
          runtime.sessionHandleKey,
        );
      } finally {
        runtime.sessionHandleKey.fill(0);
      }
      this.sessionHandles = sessionHandles;

      let sessions: SessionDiscoveryAdapter = unavailableSessions;
      if (options.devinCliPath) {
        const acp = this.dependencies.createAcpClient(options.devinCliPath);
        this.acp = acp;
        await acp.start();
        sessions = acp;
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
        host: '0.0.0.0',
        port: options.port,
        allowLan: true,
        allowedHosts: [options.advertisedHost],
      });
      this.listener = listener;
      const address = await listener.start();
      if (address.certificateFingerprint !== tlsIdentity.certificateFingerprint) {
        throw new Error('Desktop Bridge listener TLS identity changed unexpectedly');
      }
      const endpoint = `https://${options.advertisedHost}:${address.port}/`;
      this.transport = {
        bridgeEndpoint: endpoint,
        tlsCertificateFingerprint: address.certificateFingerprint,
      };
      const pairingOfferExpiresAt = this.showPairingOffer();
      return {
        endpoint,
        pairingOfferExpiresAt,
        sessionDiscoveryEnabled: sessions.isSessionListSupported(),
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

  async approve(pairingId: string, now = Date.now()): Promise<boolean> {
    if (!this.pairing || this.stopped) return false;
    return (await this.pairing.approve(pairingId, now)).ok;
  }

  deny(pairingId: string): boolean {
    if (!this.pairing || this.stopped) return false;
    return this.pairing.deny(pairingId);
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    const listener = this.listener;
    const acp = this.acp;
    const sessionHandles = this.sessionHandles;
    this.listener = null;
    this.acp = null;
    this.pairing = null;
    this.sessionHandles = null;
    this.transport = null;

    const results = await Promise.allSettled([
      listener?.stop() ?? Promise.resolve(),
      acp?.stop() ?? Promise.resolve(),
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
