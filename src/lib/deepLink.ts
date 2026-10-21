import { branding } from '@lib/branding';

export interface ParsedDeepLink {
  valid: boolean;
  reason?: string;
}

export function parseDeepLink(url: string): ParsedDeepLink {
  if (!url.startsWith(branding.linkPrefix)) {
    return { valid: false, reason: 'Wrong scheme' };
  }
  const path = url.slice(branding.linkPrefix.length).split(/[?#]/)[0] ?? '';
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) {
    return { valid: true };
  }

  return { valid: false, reason: 'Unknown route' };
}
