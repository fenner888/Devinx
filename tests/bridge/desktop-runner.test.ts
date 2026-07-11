import type { NetworkInterfaceInfo } from 'node:os';

import { parseDesktopBridgeArguments, safeTerminalText } from '../../bridge/src/cli';
import type { HttpsBridgeListenerOptions } from '../../bridge/src/listener';
import type { KeychainSecretStore } from '../../bridge/src/macos-keychain';
import {
  discoverPrivateLanAddresses,
  privateTransportKind,
  privateTransportLabel,
  validateAdvertisedLanHost,
  type NetworkInterfaceMap,
} from '../../bridge/src/network';
import {
  DesktopBridgeRunner,
  RecoverableSessionDiscoveryAdapter,
  type AcpSessionLifecycle,
  type BridgeListenerLifecycle,
  type DesktopBridgeRunnerDependencies,
} from '../../bridge/src/runner';
import { TerminalQrRenderer } from '../../bridge/src/terminal-qr';
import { OpenSslTlsIdentityGenerator, tlsIdentityFromPem } from '../../bridge/src/tls-identity';

class MemorySecretStore implements KeychainSecretStore {
  value: string | null = null;

  async get(): Promise<string | null> {
    return this.value;
  }

  async set(value: string): Promise<void> {
    this.value = value;
  }

  async delete(): Promise<void> {
    this.value = null;
  }
}

function interfaceRecord(
  address: string,
  options: { internal?: boolean; family?: 'IPv4' | 'IPv6' } = {},
): NetworkInterfaceInfo {
  const family = options.family ?? 'IPv4';
  return {
    address,
    netmask: family === 'IPv4' ? '255.255.255.0' : 'ffff:ffff:ffff:ffff::',
    family,
    mac: '00:00:00:00:00:00',
    internal: options.internal ?? false,
    cidr: family === 'IPv4' ? `${address}/24` : `${address}/64`,
    ...(family === 'IPv6' ? { scopeid: 0 } : {}),
  } as NetworkInterfaceInfo;
}

function interfaces(): NetworkInterfaceMap {
  return {
    en0: [interfaceRecord('192.168.1.141')],
    utun3: [interfaceRecord('100.127.166.87')],
    lo0: [interfaceRecord('127.0.0.1', { internal: true })],
    en6: [interfaceRecord('fe80::1', { family: 'IPv6' })],
  };
}

describe('Desktop Bridge development runner', () => {
  it('securely rehydrates listed and loaded session state after ACP replacement', async () => {
    const replacementList = jest.fn(async (input?: unknown) => {
      const cursor = (input as { cursor?: string } | undefined)?.cursor;
      return cursor
        ? { sessions: [{ sessionId: 'session-kept', cwd: '/tmp/kept' }] }
        : {
            sessions: [{ sessionId: 'session-other', cwd: '/tmp/other' }],
            nextCursor: 'page-2',
          };
    });
    const replacementLoad = jest.fn(async (sessionId: string) => ({
      sessionId,
      cwd: '/tmp/kept',
      messages: [],
      truncated: false,
    }));
    const replacementPrompt = jest.fn<Promise<void>, [string, string]>().mockResolvedValue();
    const replacement: AcpSessionLifecycle = {
      start: jest.fn<Promise<void>, []>().mockResolvedValue(),
      stop: jest.fn<Promise<void>, []>().mockResolvedValue(),
      isSessionListSupported: () => true,
      listSessions: replacementList,
      isSessionLoadSupported: () => true,
      loadSession: replacementLoad,
      isSessionPromptSupported: () => true,
      promptSession: replacementPrompt,
    };
    const adapter = new RecoverableSessionDiscoveryAdapter();
    adapter.replace(replacement);

    await expect(adapter.promptSession('session-kept', 'Continue.')).resolves.toBeUndefined();
    expect(replacementList).toHaveBeenCalledTimes(2);
    expect(replacementLoad).toHaveBeenCalledWith('session-kept');
    expect(replacementPrompt).toHaveBeenCalledWith('session-kept', 'Continue.');

    await expect(adapter.loadSession('session-missing')).rejects.toThrow(
      'not available in the current ACP process',
    );
    expect(replacementLoad).toHaveBeenCalledTimes(1);
  });

  it('discovers only active private IPv4 addresses and requires an exact interface match', () => {
    expect(discoverPrivateLanAddresses(interfaces())).toEqual(['100.127.166.87', '192.168.1.141']);
    expect(validateAdvertisedLanHost('192.168.1.141', interfaces())).toBe('192.168.1.141');
    expect(privateTransportKind('100.127.166.87')).toBe('tailscale_vpn');
    expect(privateTransportKind('fd7a:115c:a1e0::f501:a690')).toBe('tailscale_vpn');
    expect(privateTransportLabel('100.127.166.87')).toBe('Tailscale/VPN');
    expect(privateTransportKind('192.168.1.141')).toBe('local_network');
    expect(privateTransportLabel('192.168.1.141')).toBe('Same Wi-Fi');
    expect(() => validateAdvertisedLanHost('8.8.8.8', interfaces())).toThrow('private');
    expect(() => validateAdvertisedLanHost('192.168.1.200', interfaces())).toThrow('not active');
  });

  it('strictly parses non-secret CLI options and rejects duplicates or relative CLI paths', () => {
    expect(
      parseDesktopBridgeArguments([
        '--host',
        '192.168.1.141',
        '--port',
        '45832',
        '--devin-cli',
        '/usr/local/bin/devin',
      ]),
    ).toEqual({
      help: false,
      options: {
        host: '192.168.1.141',
        port: 45_832,
        devinCliPath: '/usr/local/bin/devin',
      },
    });
    expect(parseDesktopBridgeArguments(['--help'])).toEqual({ help: true });
    expect(() =>
      parseDesktopBridgeArguments(['--host', '192.168.1.141', '--host', '192.168.1.142']),
    ).toThrow('more than once');
    expect(() =>
      parseDesktopBridgeArguments(['--host', '192.168.1.141', '--devin-cli', './devin']),
    ).toThrow('invalid');
    expect(() => parseDesktopBridgeArguments(['--token', 'secret'])).toThrow('Unknown');
  });

  it('neutralizes terminal control and bidirectional formatting characters in device names', () => {
    expect(safeTerminalText('\u001b[31mFrank\u202Eevil\u2066 iPhone')).toBe(
      '[31mFrank evil iPhone',
    );
    expect(safeTerminalText('\u0000\u200b')).toBe('Unnamed iPhone');
  });

  it('renders an ephemeral TLS-bound QR offer without persisting its pairing secret', async () => {
    const secretStore = new MemorySecretStore();
    const renderedPayloads: string[] = [];
    const listenerStop = jest.fn<Promise<void>, []>().mockResolvedValue();
    let listenerOptions: HttpsBridgeListenerOptions | undefined;
    const dependencies: DesktopBridgeRunnerDependencies = {
      secretStore,
      tlsIdentityGenerator: new OpenSslTlsIdentityGenerator({ validityDays: 1 }),
      qrRenderer: { render: (payload) => renderedPayloads.push(payload) },
      createListener: (options) => {
        listenerOptions = options;
        const identity = tlsIdentityFromPem(options.tlsCertificatePem, options.tlsPrivateKeyPem);
        return {
          start: async () => ({
            host: '0.0.0.0',
            port: 45_831,
            certificateFingerprint: identity.certificateFingerprint,
          }),
          stop: listenerStop,
        };
      },
      createAcpClient: () => {
        throw new Error('ACP should not be created without an explicit CLI path');
      },
    };
    const runner = new DesktopBridgeRunner({ advertisedHost: '192.168.1.141' }, dependencies);

    const started = await runner.start();
    const offer = JSON.parse(renderedPayloads[0] ?? '{}') as Record<string, unknown>;

    expect(started).toMatchObject({
      endpoint: 'https://192.168.1.141:45831/',
      sessionDiscoveryEnabled: false,
      transportKind: 'local_network',
    });
    expect(offer).toMatchObject({
      bridgeEndpoint: started.endpoint,
      tlsCertificateFingerprint: listenerOptions
        ? tlsIdentityFromPem(listenerOptions.tlsCertificatePem, listenerOptions.tlsPrivateKeyPem)
            .certificateFingerprint
        : '',
    });
    expect(typeof offer.pairingSecret).toBe('string');
    expect(Buffer.byteLength(renderedPayloads[0] ?? '', 'utf8')).toBeLessThan(2_048);
    expect(secretStore.value).not.toContain(String(offer.pairingSecret));
    expect(listenerOptions).toMatchObject({
      host: '192.168.1.141',
      allowLan: true,
      allowedHosts: ['192.168.1.141'],
    });

    const stdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      new TerminalQrRenderer().render(renderedPayloads[0] ?? '');
      expect(stdoutWrite).toHaveBeenCalledTimes(1);
    } finally {
      stdoutWrite.mockRestore();
    }

    await runner.stop();
    expect(listenerStop).toHaveBeenCalledTimes(1);
  });

  it('binds a proxied bridge to loopback while advertising its Tailscale address', async () => {
    let listenerOptions: HttpsBridgeListenerOptions | undefined;
    const dependencies: DesktopBridgeRunnerDependencies = {
      secretStore: new MemorySecretStore(),
      tlsIdentityGenerator: new OpenSslTlsIdentityGenerator({ validityDays: 1 }),
      qrRenderer: { render: jest.fn() },
      createListener: (options) => {
        listenerOptions = options;
        const identity = tlsIdentityFromPem(options.tlsCertificatePem, options.tlsPrivateKeyPem);
        return {
          start: async () => ({
            host: '127.0.0.1',
            port: 45_832,
            certificateFingerprint: identity.certificateFingerprint,
          }),
          stop: async () => {},
        };
      },
      createAcpClient: () => {
        throw new Error('ACP should not be created');
      },
    };
    const runner = new DesktopBridgeRunner(
      {
        advertisedHost: '100.127.166.87',
        bindHost: '127.0.0.1',
        port: 45_831,
        bindPort: 45_832,
      },
      dependencies,
    );

    await expect(runner.start()).resolves.toMatchObject({
      endpoint: 'http://100.127.166.87:45831/',
      transportKind: 'tailscale_vpn',
    });
    expect(listenerOptions).toMatchObject({
      host: '127.0.0.1',
      port: 45_832,
      advertisedPort: 45_831,
      allowLan: false,
      allowedHosts: ['100.127.166.87'],
    });
    await runner.stop();
  });

  it('starts ACP only when explicitly configured and cleans it up after listener failure', async () => {
    const secretStore = new MemorySecretStore();
    const acpStart = jest.fn<Promise<void>, []>().mockResolvedValue();
    const acpStop = jest.fn<Promise<void>, []>().mockResolvedValue();
    const listenerStop = jest.fn<Promise<void>, []>().mockResolvedValue();
    const acp: AcpSessionLifecycle = {
      start: acpStart,
      stop: acpStop,
      isSessionListSupported: () => true,
      listSessions: async () => ({ sessions: [] }),
      isSessionLoadSupported: () => false,
      loadSession: async () => {
        throw new Error('Session loading is disabled');
      },
      isSessionPromptSupported: () => true,
      promptSession: async () => {},
    };
    const createAcpClient = jest.fn<AcpSessionLifecycle, [string]>(() => acp);
    const createListener = jest.fn<BridgeListenerLifecycle, [HttpsBridgeListenerOptions]>(() => ({
      start: async () => ({
        host: '0.0.0.0',
        port: 45_831,
        certificateFingerprint: 'A'.repeat(43),
      }),
      stop: listenerStop,
    }));
    const runner = new DesktopBridgeRunner(
      { advertisedHost: '192.168.1.141', devinCliPath: '/usr/local/bin/devin' },
      {
        secretStore,
        tlsIdentityGenerator: new OpenSslTlsIdentityGenerator({ validityDays: 1 }),
        qrRenderer: { render: jest.fn() },
        createListener,
        createAcpClient,
      },
    );

    await expect(runner.start()).rejects.toThrow('TLS identity changed');
    expect(createAcpClient).toHaveBeenCalledWith('/usr/local/bin/devin');
    expect(acpStart).toHaveBeenCalledTimes(1);
    expect(acpStop).toHaveBeenCalledTimes(1);
    expect(listenerStop).toHaveBeenCalledTimes(1);
  });

  it('restarts ACP session discovery after the child becomes unavailable', async () => {
    const firstStop = jest.fn<Promise<void>, []>().mockResolvedValue();
    let firstAvailable = true;
    const first: AcpSessionLifecycle = {
      start: jest.fn<Promise<void>, []>().mockResolvedValue(),
      stop: firstStop,
      isSessionListSupported: () => firstAvailable,
      listSessions: async () => ({ sessions: [] }),
      isSessionLoadSupported: () => firstAvailable,
      loadSession: async () => ({ sessionId: 'session', cwd: '/', messages: [], truncated: false }),
      isSessionPromptSupported: () => firstAvailable,
      promptSession: async () => {},
    };
    const replacementStart = jest.fn<Promise<void>, []>().mockResolvedValue();
    const replacement: AcpSessionLifecycle = {
      start: replacementStart,
      stop: jest.fn<Promise<void>, []>().mockResolvedValue(),
      isSessionListSupported: () => true,
      listSessions: async () => ({ sessions: [] }),
      isSessionLoadSupported: () => true,
      loadSession: async () => ({ sessionId: 'session', cwd: '/', messages: [], truncated: false }),
      isSessionPromptSupported: () => true,
      promptSession: async () => {},
    };
    const createAcpClient = jest
      .fn<AcpSessionLifecycle, [string]>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(replacement);
    const runner = new DesktopBridgeRunner(
      { advertisedHost: '100.127.166.87', devinCliPath: '/usr/local/bin/devin' },
      {
        secretStore: new MemorySecretStore(),
        tlsIdentityGenerator: new OpenSslTlsIdentityGenerator({ validityDays: 1 }),
        qrRenderer: { render: jest.fn() },
        createListener: (options) => {
          const identity = tlsIdentityFromPem(options.tlsCertificatePem, options.tlsPrivateKeyPem);
          return {
            start: async () => ({
              host: '100.127.166.87',
              port: 45_831,
              certificateFingerprint: identity.certificateFingerprint,
            }),
            stop: async () => {},
          };
        },
        createAcpClient,
      },
    );

    await runner.start();
    await expect(runner.recoverSessionDiscovery()).resolves.toBe(true);
    expect(createAcpClient).toHaveBeenCalledTimes(1);

    firstAvailable = false;
    await expect(runner.recoverSessionDiscovery()).resolves.toBe(true);
    expect(firstStop).toHaveBeenCalledTimes(1);
    expect(replacementStart).toHaveBeenCalledTimes(1);
    expect(createAcpClient).toHaveBeenCalledTimes(2);
    await runner.stop();
  });
});
