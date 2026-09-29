export type ConnectionMode = 'cloud' | 'computer' | 'both';

export const connectionModeOptions: ReadonlyArray<{
  key: ConnectionMode;
  label: string;
  description: string;
}> = [
  {
    key: 'cloud',
    label: 'Devin Cloud',
    description: 'Connect directly to your Devin account and cloud sessions.',
  },
  {
    key: 'computer',
    label: 'Local',
    description: 'Pair securely with DevinX Connector on a device you control.',
  },
  {
    key: 'both',
    label: 'Cloud + Local',
    description: 'See cloud and local sessions together with clear origins.',
  },
];

export function normalizeConnectionMode(value: unknown): ConnectionMode {
  return value === 'computer' || value === 'both' ? value : 'cloud';
}

export function isConnectionModeConfigured(
  mode: ConnectionMode,
  hasCloudConnection: boolean,
  hasComputerConnection: boolean,
): boolean {
  if (mode === 'cloud') return hasCloudConnection;
  if (mode === 'computer') return hasComputerConnection;
  return hasCloudConnection && hasComputerConnection;
}

export function connectionModeUsesCloud(mode: ConnectionMode): boolean {
  return mode === 'cloud' || mode === 'both';
}

export function connectionModeUsesComputer(mode: ConnectionMode): boolean {
  return mode === 'computer' || mode === 'both';
}

export function connectionModeAfterComputerRefresh(
  mode: ConnectionMode,
  hasCloudConnection: boolean,
  computerCount: number,
): ConnectionMode {
  if (mode === 'both' && hasCloudConnection && computerCount === 0) return 'cloud';
  return mode;
}

export function shouldEnableCloudRequests(
  mode: ConnectionMode,
  hasCloudCredentials: boolean,
  preferencesHydrated: boolean,
): boolean {
  return preferencesHydrated && hasCloudCredentials && connectionModeUsesCloud(mode);
}
