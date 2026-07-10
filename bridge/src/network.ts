import { isIP } from 'node:net';
import type { NetworkInterfaceInfo, NetworkInterfaceInfoIPv4 } from 'node:os';

import { z } from 'zod';

const ipv4AddressSchema = z
  .string()
  .min(7)
  .max(15)
  .refine((value) => isIP(value) === 4, 'LAN host must be an IPv4 address');

export function isPrivateLanIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const octets = address.split('.').map(Number);
  const first = octets[0];
  const second = octets[1];
  if (first === undefined || second === undefined) return false;
  return (
    first === 10 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export type PrivateTransportKind = 'local_network' | 'tailscale_vpn';

export function privateTransportKind(address: string): PrivateTransportKind {
  if (!isPrivateLanIPv4(address)) {
    throw new Error('Transport classification requires a private IPv4 address');
  }
  const [first, second] = address.split('.').map(Number);
  return first === 100 && second !== undefined && second >= 64 && second <= 127
    ? 'tailscale_vpn'
    : 'local_network';
}

export function privateTransportLabel(address: string): string {
  return privateTransportKind(address) === 'tailscale_vpn'
    ? 'Tailscale/VPN'
    : 'Same Wi-Fi';
}

function isIPv4Record(
  record: NetworkInterfaceInfo,
): record is NetworkInterfaceInfoIPv4 {
  return record.family === 'IPv4';
}

export type NetworkInterfaceMap = NodeJS.Dict<NetworkInterfaceInfo[]>;

export function discoverPrivateLanAddresses(interfaces: NetworkInterfaceMap): string[] {
  const discovered = new Set<string>();
  for (const records of Object.values(interfaces)) {
    for (const record of records ?? []) {
      if (
        isIPv4Record(record) &&
        !record.internal &&
        isPrivateLanIPv4(record.address)
      ) {
        discovered.add(record.address);
      }
    }
  }
  return [...discovered].sort((left, right) => left.localeCompare(right));
}

export function validateAdvertisedLanHost(
  input: unknown,
  interfaces: NetworkInterfaceMap,
): string {
  const host = ipv4AddressSchema.parse(input);
  if (!isPrivateLanIPv4(host)) {
    throw new Error('Desktop Bridge host must be a private or link-local IPv4 address');
  }
  if (!discoverPrivateLanAddresses(interfaces).includes(host)) {
    throw new Error('Desktop Bridge host is not active on this Mac');
  }
  return host;
}
