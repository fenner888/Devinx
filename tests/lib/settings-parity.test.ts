import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '..', '..');

describe('supported Settings parity', () => {
  it('includes the Configuration Hub and supported Cloud navigation', () => {
    const settings = readFileSync(resolve(repositoryRoot, 'src/app/(main)/settings.tsx'), 'utf8');
    expect(settings).toContain('Action Center');
    expect(settings).toContain("router.push('/(main)/action-center')");
    expect(settings).toContain('Launch profiles');
    expect(settings).toContain("router.push('/(main)/launch-profiles')");
    expect(settings).toContain('Environment setup');
    expect(settings).toContain("router.push('/(main)/environment')");
    expect(settings).toContain('Integrations & MCP');
    expect(settings).toContain("route: '/(main)/automations'");
    expect(settings).toContain("route: '/(main)/repositories'");
  });

  it('does not render unsupported account-administration settings as dead mobile rows', () => {
    const settings = readFileSync(resolve(repositoryRoot, 'src/app/(main)/settings.tsx'), 'utf8');
    for (const unsupported of [
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

  it('implements environment setup only as a previewed public Cloud session', () => {
    const environment = readFileSync(
      resolve(repositoryRoot, 'src/app/(main)/environment.tsx'),
      'utf8',
    );
    const assistant = readFileSync(
      resolve(repositoryRoot, 'src/lib/environment-assistant.ts'),
      'utf8',
    );
    const sources = `${environment}\n${assistant}`;

    expect(environment).toContain('useCreateSession');
    expect(environment).toContain('Review session prompt');
    expect(environment).toContain('Start setup session');
    expect(sources).not.toMatch(/document\.cookie|Cookie:|localStorage/);
    expect(sources).not.toMatch(/['"`]\/[^'"`\s]*(?:environment[_/-](?:blueprint|snapshot))/i);
    expect(sources).not.toContain('app.devin.ai/api');
  });

  it('keeps local-device profiles capability-derived and read-only', () => {
    const profile = readFileSync(
      resolve(repositoryRoot, 'src/app/(main)/computer-profile/[bridgeId].tsx'),
      'utf8',
    );

    expect(profile).toContain('Live health');
    expect(profile).toContain('iPhone grants');
    expect(profile).toContain('Observed workspaces');
    expect(profile).not.toMatch(/TextInput|shell command|environment variable/i);
  });

  it('provides an explicit recovery action when Action Center sources fail', () => {
    const actionCenter = readFileSync(
      resolve(repositoryRoot, 'src/app/(main)/action-center.tsx'),
      'utf8',
    );

    expect(actionCenter).toContain('Retry Action Center refresh');
    expect(actionCenter).toContain('cloud.refetch()');
    expect(actionCenter).toContain('computer.refetch()');
  });
});
