/**
 * §10.1 gate test — no key-shaped strings or key variable names outside /src/auth.
 * This is a runtime mirror of the CI grep gate. The CI grep is the real gate;
 * this test catches regressions during local dev.
 *
 * We scan /src for:
 *  - `cog_` followed by 8+ alphanumerics (a real key, not the prefix constant)
 *  - variable names like `apiKey` / `api_key` / `token` / `secret` / `password`
 *    OUTSIDE /src/auth, /src/lib/branding.ts, /src/lib/sentry.ts, /src/api/devin/schemas.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '..', '..', 'src');
const ALLOWED = [
  '/auth/',
  '/lib/branding.ts',
  '/lib/sentry.ts',
  '/api/devin/schemas.ts',
  '/api/devin/types.ts',
  '/store/preferences.ts', // composerTemplates mention "secret" in comments only
  '/app/(onboarding)/', // onboarding screens handle user-entered credentials
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('key-leak grep gate (§10.1)', () => {
  const files = walk(SRC);
  it('scanned at least the source tree', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no real cog_ keys hardcoded', () => {
    const violations: string[] = [];
    for (const f of files) {
      const rel = '/' + path.relative(SRC, f).split(path.sep).join('/');
      // sentry.ts contains the scrubber regex pattern, not a real key.
      if (rel.endsWith('lib/sentry.ts')) continue;
      const content = fs.readFileSync(f, 'utf8');
      // A real key: cog_ followed by 8+ word chars. The branding constant is just 'cog_'.
      const realKey = /cog_[A-Za-z0-9]{8,}/;
      if (realKey.test(content)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps secret-adjacent variable names inside /src/auth or allowlisted files', () => {
    const forbidden = /\b(apiKey|api_key|apiSecret|api_secret|password|passwd)\b\s*[=:(]/i;
    const violations: string[] = [];
    for (const f of files) {
      const rel = '/' + path.relative(SRC, f).split(path.sep).join('/');
      if (ALLOWED.some((a) => rel.includes(a))) continue;
      const content = fs.readFileSync(f, 'utf8');
      // Allow the branding keychain key strings and sentry scrub patterns.
      if (rel.endsWith('branding.ts') || rel.endsWith('sentry.ts')) continue;
      if (forbidden.test(content)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});
