import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '../..');

describe('release onboarding', () => {
  it('keeps connection claims truthful and unavailable auth modes out of the default UI', () => {
    const welcome = readFileSync(resolve(repositoryRoot, 'src/app/(onboarding)/index.tsx'), 'utf8');
    const features = readFileSync(
      resolve(repositoryRoot, 'src/app/(onboarding)/features.tsx'),
      'utf8',
    );
    const connections = readFileSync(
      resolve(repositoryRoot, 'src/app/(onboarding)/connections.tsx'),
      'utf8',
    );
    const credentials = readFileSync(
      resolve(repositoryRoot, 'src/app/(onboarding)/credentials.tsx'),
      'utf8',
    );

    expect(welcome).toContain('Run Devin from anywhere.');
    expect(welcome).toContain('{branding.disclaimer}');
    expect(features).toContain('Cloud or your computer');
    expect(features).toContain('Keep credentials private');
    expect(features).not.toContain('Manage files');
    expect(connections).toContain('Choose where Devin runs');
    expect(connections).toContain('never copied to your phone');
    expect(credentials).not.toContain('Personal token');
    expect(credentials).not.toContain('Personal access token');
  });
});
