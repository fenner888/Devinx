export const MINIMUM_SUPPORTED_CONNECTOR_VERSION = '0.1.2' as const;

function semanticVersionParts(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) return null;
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function isConnectorUpdateRequired(version: string): boolean {
  const actual = semanticVersionParts(version);
  const minimum = semanticVersionParts(MINIMUM_SUPPORTED_CONNECTOR_VERSION);
  if (!actual || !minimum) return true;
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] !== minimum[index]) return (actual[index] ?? 0) < (minimum[index] ?? 0);
  }
  return false;
}
