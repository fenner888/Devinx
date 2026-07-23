import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, isAbsolute, join, win32 } from 'node:path';

import { z } from 'zod';

import { MacOSKeychainSecretStore } from './macos-keychain';
import type { NetworkInterfaceMap } from './network';
import {
  discoverPrivateLanAddresses,
  isAdvertisablePrivateAddress,
  isTailscaleIPv4,
} from './network';
import type { SecretStore } from './secret-store';
import { WindowsDpapiSecretStore } from './windows-dpapi';

export type ConnectorPlatformId = 'macos' | 'windows' | 'linux';

export interface ConnectorPlatformAdapter {
  readonly id: ConnectorPlatformId;
  createSecretStore(): SecretStore;
  discoverPrivateAddresses(interfaces: NetworkInterfaceMap): string[];
  discoverDevinCli(environment: NodeJS.ProcessEnv): Promise<string | null>;
  discoverDevinSessionDb(environment: NodeJS.ProcessEnv): Promise<string | null>;
}

const pathEntrySchema = z.string().min(1).max(4_096);

export function selectPreferredConnectorAddress(
  addressesInput: readonly string[],
): string {
  const addresses = z
    .array(
      z
        .string()
        .min(2)
        .max(64)
        .refine(
          isAdvertisablePrivateAddress,
          'Connector addresses must be advertisable private IP addresses',
        ),
    )
    .max(128)
    .parse(addressesInput);
  const selected = addresses.find(isTailscaleIPv4);
  if (!selected) {
    throw new Error('Tailscale is not connected. Connect this computer to Tailscale and try again');
  }
  return selected;
}

export function executableCandidates(environment: NodeJS.ProcessEnv): string[] {
  const pathValue = environment.PATH;
  if (!pathValue) return [];
  const candidates = new Set<string>();
  for (const rawEntry of pathValue.split(delimiter)) {
    const result = pathEntrySchema.safeParse(rawEntry);
    if (!result.success || !isAbsolute(result.data)) continue;
    candidates.add(join(result.data, 'devin'));
  }
  return [...candidates];
}

export function windowsDevinCliCandidates(environment: NodeJS.ProcessEnv): string[] {
  const pathValue = environment.Path ?? environment.PATH;
  if (!pathValue) return [];
  const candidates = new Set<string>();
  for (const rawEntry of pathValue.split(win32.delimiter)) {
    const result = pathEntrySchema.safeParse(rawEntry);
    if (!result.success || !win32.isAbsolute(result.data)) continue;
    candidates.add(win32.join(result.data, 'devin.exe'));
    candidates.add(win32.join(result.data, 'devin.cmd'));
  }
  return [...candidates];
}

export function macOSDevinCliCandidates(environment: NodeJS.ProcessEnv): string[] {
  const candidates = new Set(executableCandidates(environment));
  candidates.add(
    '/Applications/Devin.app/Contents/Resources/app/extensions/windsurf/devin/bin/devin',
  );
  const home = environment.HOME;
  if (home && isAbsolute(home)) {
    candidates.add(
      join(
        home,
        'Applications',
        'Devin.app',
        'Contents',
        'Resources',
        'app',
        'extensions',
        'windsurf',
        'devin',
        'bin',
        'devin',
      ),
    );
  }
  return [...candidates];
}

async function firstExecutable(candidates: readonly string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Missing candidates are expected while checking supported installation locations.
    }
  }
  return null;
}

export async function discoverDevinCliFromPath(
  environment: NodeJS.ProcessEnv,
): Promise<string | null> {
  return firstExecutable(executableCandidates(environment));
}

export async function discoverMacOSDevinCli(
  environment: NodeJS.ProcessEnv,
): Promise<string | null> {
  return firstExecutable(macOSDevinCliCandidates(environment));
}

export async function discoverMacOSDevinSessionDb(
  environment: NodeJS.ProcessEnv,
): Promise<string | null> {
  const home = environment.HOME;
  if (!home || !isAbsolute(home)) return null;
  const candidate = join(home, '.local', 'share', 'devin', 'cli', 'sessions.db');
  try {
    await access(candidate, constants.R_OK);
    return candidate;
  } catch {
    return null;
  }
}

export async function discoverWindowsDevinCli(
  environment: NodeJS.ProcessEnv,
): Promise<string | null> {
  return firstExecutable(windowsDevinCliCandidates(environment));
}

export class MacOSConnectorPlatformAdapter implements ConnectorPlatformAdapter {
  readonly id = 'macos' as const;

  createSecretStore(): SecretStore {
    return new MacOSKeychainSecretStore();
  }

  discoverPrivateAddresses(interfaces: NetworkInterfaceMap): string[] {
    return discoverPrivateLanAddresses(interfaces);
  }

  discoverDevinCli(environment: NodeJS.ProcessEnv): Promise<string | null> {
    return discoverMacOSDevinCli(environment);
  }

  discoverDevinSessionDb(environment: NodeJS.ProcessEnv): Promise<string | null> {
    return discoverMacOSDevinSessionDb(environment);
  }
}

export class WindowsConnectorPlatformAdapter implements ConnectorPlatformAdapter {
  readonly id = 'windows' as const;

  createSecretStore(): SecretStore {
    return new WindowsDpapiSecretStore();
  }

  discoverPrivateAddresses(interfaces: NetworkInterfaceMap): string[] {
    return discoverPrivateLanAddresses(interfaces);
  }

  discoverDevinCli(environment: NodeJS.ProcessEnv): Promise<string | null> {
    return discoverWindowsDevinCli(environment);
  }

  async discoverDevinSessionDb(): Promise<string | null> {
    // No public Windows location has been verified. ACP remains the only supported source.
    return null;
  }
}

export function createConnectorPlatformAdapter(
  platform: NodeJS.Platform = process.platform,
): ConnectorPlatformAdapter {
  if (platform === 'darwin') return new MacOSConnectorPlatformAdapter();
  if (platform === 'win32') return new WindowsConnectorPlatformAdapter();
  if (platform === 'linux') {
    throw new Error('The Linux DevinX Connector adapter is not available yet');
  }
  throw new Error('This operating system is not supported by DevinX Connector');
}
