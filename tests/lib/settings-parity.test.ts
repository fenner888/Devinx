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
});
