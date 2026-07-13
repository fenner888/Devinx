import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '..', '..');

describe('supported Settings parity', () => {
  it('includes supported integrations, Wiki, and Automations navigation', () => {
    const settings = readFileSync(resolve(repositoryRoot, 'src/app/(main)/settings.tsx'), 'utf8');
    expect(settings).toContain('Integrations & MCP');
    expect(settings).toContain("route: '/(main)/automations'");
    expect(settings).toContain("route: '/(main)/repositories'");
  });

  it('does not render unsupported account-administration settings as dead mobile rows', () => {
    const settings = readFileSync(resolve(repositoryRoot, 'src/app/(main)/settings.tsx'), 'utf8');
    for (const unsupported of [
      '>Environment<',
      '>Skills & Rules<',
      '>Membership<',
      '>Plans<',
      '>Invoices<',
      '>Devin API<',
    ]) {
      expect(settings).not.toContain(unsupported);
    }
  });

  it('does not compile the unsupported repository-indexing mutation', () => {
    const sources = [
      'src/app/(main)/compose.tsx',
      'src/api/devin/endpoints.ts',
      'src/api/devin/queries.ts',
      'src/api/devin/types.ts',
    ]
      .map((path) => readFileSync(resolve(repositoryRoot, path), 'utf8'))
      .join('\n');

    expect(sources).not.toContain('indexRepository');
    expect(sources).not.toContain('useIndexRepository');
    expect(sources).not.toContain('/indexing');
    expect(sources).not.toContain('>Index</Text>');
  });

  it('keeps unavailable billing management out of the native Usage screen', () => {
    const usage = readFileSync(resolve(repositoryRoot, 'src/app/(main)/usage.tsx'), 'utf8');
    expect(usage).not.toContain('app.devin.ai/settings/usage-limits');
    expect(usage).not.toContain('Manage billing on Devin web');
    expect(usage).toContain('until Devin publishes a supported account-scoped management API');
  });
});
