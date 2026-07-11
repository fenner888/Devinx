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

  it('describes the current Tailscale and app-delivery paths', () => {
    const privacyScreen = readFileSync(
      resolve(repositoryRoot, 'src/app/(main)/privacy.tsx'),
      'utf8',
    );

    expect(privacyScreen).toContain('directly from your Mac over Tailscale');
    expect(privacyScreen).toContain('contact Expo over TLS');
    expect(privacyScreen).toContain('does not register your iPhone for remote push notifications');
    expect(privacyScreen).not.toContain('over pinned TLS');
  });
});
