import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '..', '..');
const readSource = (path: string) => readFileSync(resolve(repositoryRoot, path), 'utf8');

describe('Local-only onboarding', () => {
  it('starts with the approved copy and three-step progress', () => {
    const welcome = readSource('src/app/(onboarding)/index.tsx');

    expect(welcome).toContain('Your coding agent, in your pocket.');
    expect(welcome).toMatch(
      /Start, follow and steer local Devin sessions on your Mac or Windows PC from your\s+iPhone\./,
    );
    expect(welcome).toContain('Local only');
    expect(welcome).toContain('On-device voice');
    expect(welcome).toContain('total={3}');
  });

  it('routes Features directly to Mac pairing and omits Cloud onboarding routes', () => {
    const features = readSource('src/app/(onboarding)/features.tsx');
    const computer = readSource('src/app/(onboarding)/computer.tsx');

    expect(features).toContain("router.push('/(onboarding)/computer')");
    expect(features).toContain('Create and steer sessions');
    expect(features).toContain('Answer approvals and questions');
    expect(features).toContain('Speak detailed prompts');
    expect(features).toContain('Keep credentials private');
    expect(features).toContain(
      'Your Devin sign-in stays on your computer. This app keeps only its pairing key in iOS Keychain.',
    );
    expect(computer).toContain('total={3}');
    expect(computer).not.toMatch(/connectionMode|mode === ['"]both|\/credentials/);
    for (const route of ['connections.tsx', 'credentials.tsx', 'validate.tsx']) {
      expect(existsSync(resolve(repositoryRoot, 'src/app/(onboarding)', route))).toBe(false);
    }
  });
});
