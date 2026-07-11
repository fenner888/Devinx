import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CONNECTOR_IPC_VERSION,
  connectorEventSchema,
  encodeConnectorEvent,
  parseConnectorCommand,
} from '../../bridge/src/connector-ipc';
import {
  createConnectorPlatformAdapter,
  discoverDevinCliFromPath,
  discoverMacOSDevinSessionDb,
  executableCandidates,
  macOSDevinCliCandidates,
  selectPreferredConnectorAddress,
} from '../../bridge/src/connector-platform';
import { connectorStartupErrorCode } from '../../bridge/src/connector-cli';

describe('DevinX Connector platform and IPC boundary', () => {
  it('requires an active Tailscale address without a LAN fallback', () => {
    expect(
      selectPreferredConnectorAddress([
        '192.168.1.10',
        '100.90.80.70',
        'fd7a:115c:a1e0::1234:5678',
      ]),
    ).toBe('100.90.80.70');
    expect(() => selectPreferredConnectorAddress(['192.168.1.10'])).toThrow('Tailscale');
    expect(() => selectPreferredConnectorAddress([])).toThrow('Tailscale');
    expect(
      connectorStartupErrorCode(
        new Error('Tailscale is not connected. Connect this computer to Tailscale and try again'),
      ),
    ).toBe('tailscale_unavailable');
    expect(connectorStartupErrorCode(new Error('private startup detail'))).toBe(
      'bridge_start_failed',
    );
  });

  it('discovers only absolute executable candidates from PATH', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devinx-connector-path-'));
    const executable = join(directory, 'devin');
    try {
      await writeFile(executable, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
      await chmod(executable, 0o700);
      expect(
        executableCandidates({ NODE_ENV: 'test', PATH: `${directory}:relative::${directory}` }),
      ).toEqual([executable]);
      await expect(discoverDevinCliFromPath({ NODE_ENV: 'test', PATH: directory })).resolves.toBe(
        executable,
      );
      await chmod(executable, 0o600);
      await expect(
        discoverDevinCliFromPath({ NODE_ENV: 'test', PATH: directory }),
      ).resolves.toBeNull();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('checks the supported Devin desktop installation when a GUI PATH omits the CLI', () => {
    const candidates = macOSDevinCliCandidates({
      HOME: '/Users/tester',
      NODE_ENV: 'test',
      PATH: '/usr/bin:/bin',
    });

    expect(candidates).toContain(
      '/Applications/Devin.app/Contents/Resources/app/extensions/windsurf/devin/bin/devin',
    );
    expect(candidates).toContain(
      '/Users/tester/Applications/Devin.app/Contents/Resources/app/extensions/windsurf/devin/bin/devin',
    );
    expect(candidates.every((candidate) => candidate.startsWith('/'))).toBe(true);
  });

  it('derives the read-only Devin session store only from an absolute home', async () => {
    await expect(
      discoverMacOSDevinSessionDb({ NODE_ENV: 'test', HOME: 'relative' }),
    ).resolves.toBeNull();
    await expect(
      discoverMacOSDevinSessionDb({ NODE_ENV: 'test', HOME: '/missing-home' }),
    ).resolves.toBeNull();
  });

  it('strictly validates bounded local connector commands and events', () => {
    const pairingId = 'pairing_1234567890abcdef';
    expect(
      parseConnectorCommand(
        JSON.stringify({
          version: CONNECTOR_IPC_VERSION,
          type: 'approve',
          pairingId,
          allowSessionContent: true,
        }),
      ),
    ).toEqual({
      version: CONNECTOR_IPC_VERSION,
      type: 'approve',
      pairingId,
      allowSessionContent: true,
    });
    expect(() =>
      parseConnectorCommand(
        JSON.stringify({
          version: CONNECTOR_IPC_VERSION,
          type: 'approve',
          pairingId,
          allowSessionContent: true,
          token: 'not-allowed',
        }),
      ),
    ).toThrow();
    expect(() => parseConnectorCommand('{')).toThrow('not valid JSON');
    expect(
      parseConnectorCommand(
        JSON.stringify({
          version: CONNECTOR_IPC_VERSION,
          type: 'update_device',
          deviceId: 'device_1234567890abcdef',
          allowSessionContent: true,
          allowSessionPrompt: false,
        }),
      ),
    ).toMatchObject({ type: 'update_device', allowSessionContent: true });
    expect(
      parseConnectorCommand(
        JSON.stringify({
          version: CONNECTOR_IPC_VERSION,
          type: 'revoke_device',
          deviceId: 'device_1234567890abcdef',
        }),
      ),
    ).toMatchObject({ type: 'revoke_device' });

    const line = encodeConnectorEvent({
      version: CONNECTOR_IPC_VERSION,
      type: 'ready',
      transport: 'tailscale_vpn',
      sessionDiscoveryEnabled: true,
      cliDetected: true,
    });
    expect(line.endsWith('\n')).toBe(true);
    expect(connectorEventSchema.parse(JSON.parse(line))).toMatchObject({ type: 'ready' });
    expect(
      connectorEventSchema.parse({
        version: CONNECTOR_IPC_VERSION,
        type: 'devices',
        devices: [
          {
            deviceId: 'device_1234567890abcdef',
            deviceName: 'Frank’s iPhone',
            pairedAt: 1_800_000_000_000,
            status: 'active',
            allowSessionContent: true,
            allowSessionPrompt: false,
          },
        ],
      }),
    ).toMatchObject({ type: 'devices', devices: [{ deviceName: 'Frank’s iPhone' }] });
    expect(
      connectorEventSchema.parse(
        JSON.parse(
          encodeConnectorEvent({
            version: CONNECTOR_IPC_VERSION,
            type: 'pairing_diagnostic',
            route: 'pairing_submit',
            phase: 'handler',
            status: 404,
          }),
        ),
      ),
    ).toEqual({
      version: CONNECTOR_IPC_VERSION,
      type: 'pairing_diagnostic',
      route: 'pairing_submit',
      phase: 'handler',
      status: 404,
    });
    expect(
      connectorEventSchema.parse({
        version: CONNECTOR_IPC_VERSION,
        type: 'pairing_diagnostic',
        route: 'protected_request',
        phase: 'handler',
        status: 200,
      }),
    ).toMatchObject({ route: 'protected_request', status: 200 });
  });

  it('fails closed for connector platform adapters that are not implemented yet', () => {
    expect(createConnectorPlatformAdapter('darwin').id).toBe('macos');
    expect(() => createConnectorPlatformAdapter('win32')).toThrow('Windows');
    expect(() => createConnectorPlatformAdapter('linux')).toThrow('Linux');
  });
});
