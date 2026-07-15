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
    const computer = readFileSync(
      resolve(repositoryRoot, 'src/app/(onboarding)/computer.tsx'),
      'utf8',
    );

    expect(welcome).toContain('Run Devin from anywhere.');
    expect(welcome).toContain('{branding.disclaimer}');
    expect(welcome).toContain("WORDMARK_DARK from '../../../assets/wordmark.png'");
    expect(welcome).toContain("WORDMARK_LIGHT from '../../../assets/wordmark-light.png'");
    expect(welcome).not.toContain('companionStageGlow');
    expect(welcome).not.toContain('companionStageLine');
    expect(welcome).not.toContain("APP_ICON from '../../../assets/icon.png'");
    expect(features).toContain('Cloud or your computer');
    expect(features).toContain('Keep credentials private');
    expect(features).not.toContain('Manage files');
    expect(connections).toContain('Choose where Devin runs');
    expect(connections).toContain('Tailscale provides the private network route');
    expect(connections).toContain('DevinX Connector provides authorized');
    expect(credentials).not.toContain('Personal token');
    expect(credentials).not.toContain('Personal access token');
    expect(credentials).toContain("connectionMode === 'both'");
    expect(credentials).toContain('STEP 1 OF 2');
    expect(credentials).toContain('Connect Cloud & continue');
    expect(computer).toContain("mode === 'both'");
    expect(computer).toContain('STEP 2 OF 2');
    expect(computer).toContain('Pair your computer');
    expect(computer).toContain('Devin Cloud is connected.');
    expect(computer).toContain('Send assisted setup prompt');
    expect(computer).toContain('Tailscale alone does not expose Devin sessions');
    expect(computer).toContain('CONNECTOR_SETUP_PROMPT');
    expect(computer).toContain('CONNECTOR_RELEASE_PAGE');
    expect(computer).toContain('Remove from this iPhone');
    expect(computer).toContain('inactive Mac record');
  });
});
