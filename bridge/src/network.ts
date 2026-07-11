import { isIP } from 'node:net';
import type { NetworkInterfaceInfo } from 'node:os';

import { z } from 'zod';

const ipv4AddressSchema = z
  .string()
  .min(7)
  .max(15)
  .refine((value) => isIP(value) === 4, 'LAN host must be an IPv4 address');

const privateAddressSchema = z
  .string()
  .min(2)
  .max(64)
  .refine(isAdvertisablePrivateAddress, 'Host must be an advertisable private IP address');

export function isTailscaleIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [first, second] = address.split('.').map(Number);
  return first === 100 && second !== undefined && second >= 64 && second <= 127;
}

export function isTailscaleIPv6(address: string): boolean {
  return isIP(address) === 6 && address.toLowerCase().startsWith('fd7a:115c:a1e0:');
}

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

export function isAdvertisablePrivateAddress(address: string): boolean {
  return isPrivateLanIPv4(address) || isTailscaleIPv6(address);
}

export type PrivateTransportKind = 'local_network' | 'tailscale_vpn';

export function privateTransportKind(address: string): PrivateTransportKind {
  if (!isAdvertisablePrivateAddress(address)) {
    throw new Error('Transport classification requires an advertisable private IP address');
  }
  return isTailscaleIPv4(address) || isTailscaleIPv6(address)
    ? 'tailscale_vpn'
    : 'local_network';
}

export function privateTransportLabel(address: string): string {
  return privateTransportKind(address) === 'tailscale_vpn'
    ? 'Tailscale/VPN'
    : 'Same Wi-Fi';
}

export type NetworkInterfaceMap = NodeJS.Dict<NetworkInterfaceInfo[]>;

export function discoverPrivateLanAddresses(interfaces: NetworkInterfaceMap): string[] {
  const discovered = new Set<string>();
  for (const records of Object.values(interfaces)) {
    for (const record of records ?? []) {
      if (
        !record.internal &&
        isAdvertisablePrivateAddress(record.address)
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

export function validateAdvertisedPrivateHost(
  input: unknown,
  interfaces: NetworkInterfaceMap,
): string {
  const host = privateAddressSchema.parse(input);
  if (!discoverPrivateLanAddresses(interfaces).includes(host)) {
    throw new Error('Desktop Bridge host is not active on this computer');
  }
  return host;
}
