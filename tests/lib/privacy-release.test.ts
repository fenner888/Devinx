import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '..', '..');

describe('release privacy configuration', () => {
  it('does not register for unused remote push notifications', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const rootLayout = readFileSync(resolve(repositoryRoot, 'src/app/_layout.tsx'), 'utf8');

    expect(packageJson.dependencies).not.toHaveProperty('expo-notifications');
    expect(rootLayout).not.toMatch(/expo-notifications|getPushToken|requestNotificationPermissions/);
  });

  it('does not bundle a dormant crash-reporting SDK', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const appJson = readFileSync(resolve(repositoryRoot, 'app.json'), 'utf8');

    expect(packageJson.dependencies).not.toHaveProperty('@sentry/react-native');
    expect(appJson).not.toContain('@sentry/react-native');
  });

  it('describes the current Tailscale and app-delivery paths', () => {
    const privacyScreen = readFileSync(
      resolve(repositoryRoot, 'src/app/(main)/privacy.tsx'),
      'utf8',
    );

    expect(privacyScreen).toContain('directly from your Mac over Tailscale');
    expect(privacyScreen).toContain('contact Expo over TLS');
    expect(privacyScreen).toContain('randomized installation token');
    expect(privacyScreen).toContain('does not register your iPhone for remote push notifications');
    expect(privacyScreen).toContain('Your controls and deletion');
    expect(privacyScreen).toContain('https://github.com/fenner888/Devinx/blob/main/PRIVACY.md');
    expect(privacyScreen).not.toContain('over pinned TLS');

    const privacyPolicy = readFileSync(resolve(repositoryRoot, 'PRIVACY.md'), 'utf8');
    expect(privacyPolicy).toContain('randomized token');

    const privacyReview = readFileSync(
      resolve(repositoryRoot, 'docs/app-privacy-review.md'),
      'utf8',
    );
    expect(privacyReview).toContain(
      '| Device ID | App Functionality (EAS Update randomized installation token) | No | No |',
    );
  });
});
