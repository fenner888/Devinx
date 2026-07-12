/**
 * Local diagnostic boundary.
 *
 * The current release intentionally has no crash-reporting destination or
 * analytics SDK. Callers use this function instead of logging errors that may
 * contain credentials, URLs, session IDs, prompts, or message content.
 */
export function captureDiagnostic(_error: unknown): void {
  // Intentionally no-op. A future reporting provider requires a new privacy
  // review, explicit release configuration, and the scrubber below.
}

const KEY_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /Bearer\s+[A-Za-z0-9._~+/=-]+/gi, replacement: '[bearer_redacted]' },
  { pattern: /cog_[A-Za-z0-9_-]+/g, replacement: '[cog_redacted]' },
  { pattern: /org-[A-Za-z0-9_-]+/g, replacement: '[org_redacted]' },
  { pattern: /devin-[A-Za-z0-9_-]+/g, replacement: '[devin_redacted]' },
  { pattern: /[A-Za-z0-9_-]{24,}/g, replacement: '[token_redacted]' },
];

export function scrubDiagnosticString(input: string): string {
  let output = input;
  for (const { pattern, replacement } of KEY_PATTERNS) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

export function scrubDiagnosticValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[max_depth]';
  if (typeof value === 'string') return scrubDiagnosticString(value);
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => scrubDiagnosticValue(item, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/authorization|api[-_]?key|token|secret|password|cookie|header/i.test(key)) {
      output[key] = '[redacted]';
    } else if (/message|prompt|body|content|text|transcript/i.test(key)) {
      output[key] = '[content_redacted]';
    } else {
      output[key] = scrubDiagnosticValue(nestedValue, depth + 1);
    }
  }
  return output;
}
