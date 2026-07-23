import type { SessionSecretInput } from '@api/devin/types';

export const MAX_STRUCTURED_OUTPUT_SCHEMA_BYTES = 65_536;

/**
 * Parse the advanced, non-secret session-create text fields. These helpers are
 * deliberately pure so outbound validation can be tested without rendering
 * the composer.
 */
export function parseSessionLinks(value: string): string[] | undefined {
  const links = value
    .split(/\r?\n/)
    .map((link) => link.trim())
    .filter(Boolean);
  return links.length > 0 ? links : undefined;
}

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function parseStructuredOutputSchema(value: string): Record<string, unknown> | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (utf8ByteLength(trimmed) > MAX_STRUCTURED_OUTPUT_SCHEMA_BYTES) {
    throw new Error('Structured output schema must be 64 KB or smaller.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Structured output schema must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Structured output schema must be a JSON object.');
  }
  const pending: unknown[] = [parsed];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    for (const [key, nested] of Object.entries(current)) {
      if (key === '$ref' && typeof nested === 'string' && !nested.startsWith('#/')) {
        throw new Error('Structured output schema cannot use external $ref values.');
      }
      pending.push(nested);
    }
  }
  return parsed as Record<string, unknown>;
}

export function normalizeSessionSecrets(
  secrets: readonly SessionSecretInput[],
): SessionSecretInput[] | undefined {
  const normalized = secrets
    .map((secret) => ({
      key: secret.key.trim(),
      value: secret.value,
      sensitive: secret.sensitive ?? true,
    }))
    .filter((secret) => secret.key.length > 0 || secret.value.length > 0);

  for (const secret of normalized) {
    if (!secret.key || !secret.value) {
      throw new Error('Each session secret needs both a name and a value.');
    }
  }
  return normalized.length > 0 ? normalized : undefined;
}
