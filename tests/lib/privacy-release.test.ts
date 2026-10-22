import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '..', '..');

describe('release privacy configuration', () => {
  it('uses transparent, theme-matched launch branding', () => {
    const appJson = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'app.json'), 'utf8'),
    ) as {
      expo: {
        plugins: Array<string | [string, Record<string, unknown>]>;
      };
    };
    const splashPlugin = appJson.expo.plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    );

    expect(splashPlugin?.[1]).toMatchObject({
      image: './assets/wordmark-light.png',
      backgroundColor: '#FCFCFC',
      dark: {
        image: './assets/wordmark.png',
        backgroundColor: '#000000',
      },
    });
    const darkWordmark = readFileSync(resolve(repositoryRoot, 'assets/wordmark.png'));
    const lightWordmark = readFileSync(resolve(repositoryRoot, 'assets/wordmark-light.png'));
    expect(darkWordmark[25]).toBe(6); // PNG RGBA, not an embedded rectangular background.
    expect(lightWordmark[25]).toBe(6);
  });

  it('does not register for unused remote push notifications', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const rootLayout = readFileSync(resolve(repositoryRoot, 'src/app/_layout.tsx'), 'utf8');

    expect(packageJson.dependencies).not.toHaveProperty('expo-notifications');
    expect(rootLayout).not.toMatch(/expo-notifications|getPushToken|requestNotificationPermissions/);
    expect(existsSync(resolve(repositoryRoot, 'scripts/notifier/index.mjs'))).toBe(false);
    expect(readFileSync(resolve(repositoryRoot, 'RELEASE.md'), 'utf8')).toContain(
      'does not request notification permission, register an Expo push token, or ship a notifier service',
    );
  });

  it('does not bundle a dormant crash-reporting SDK', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const appJson = readFileSync(resolve(repositoryRoot, 'app.json'), 'utf8');

    expect(packageJson.dependencies).not.toHaveProperty('@sentry/react-native');
    expect(appJson).not.toContain('@sentry/react-native');
    expect(readFileSync(resolve(repositoryRoot, 'RELEASE.md'), 'utf8')).not.toContain(
      'Sentry is optional',
    );
  });

  it('keeps CI on the exact repository Node runtime', () => {
    const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
    const nodeVersion = readFileSync(resolve(repositoryRoot, '.nvmrc'), 'utf8').trim();
    const packageJson = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
    ) as { engines?: { node?: string } };

    expect(workflow).toContain("node-version-file: '.nvmrc'");
    expect(packageJson.engines?.node).toBe(nodeVersion);
  });

  it('keeps the in-app privacy screen Local-only', () => {
    const privacyScreen = readFileSync(
      resolve(repositoryRoot, 'src/app/(main)/privacy.tsx'),
      'utf8',
    );

    expect(privacyScreen).toContain('directly from your computer over Tailscale');
    expect(privacyScreen).toContain('Paired-device keys stay in the system Keychain');
    expect(privacyScreen).not.toContain('prompt templates');
    expect(privacyScreen).not.toMatch(/Devin Cloud|Devin API|api\.devin\.ai|official Devin MCP/i);
  });

  it('describes the current Tailscale and app-delivery paths', () => {
    const privacyScreen = readFileSync(
      resolve(repositoryRoot, 'src/app/(main)/privacy.tsx'),
      'utf8',
    );

    expect(privacyScreen).toContain('directly from your computer over Tailscale');
    expect(privacyScreen).toContain('contact Expo over TLS');
    expect(privacyScreen).toContain('randomized installation token');
    expect(privacyScreen).toContain('does not register your iPhone for remote push notifications');
    expect(privacyScreen).toContain('Your controls and deletion');
    expect(privacyScreen).toContain('https://github.com/fenner888/Otterin/blob/main/PRIVACY.md');
    expect(privacyScreen).not.toContain('over pinned TLS');

    const privacyPolicy = readFileSync(resolve(repositoryRoot, 'PRIVACY.md'), 'utf8');
    expect(privacyPolicy).toContain('randomized token');
    expect(privacyPolicy).not.toMatch(/Devin Cloud|Devin API|api\.devin\.ai|official Devin MCP/i);

    const privacyReview = readFileSync(
      resolve(repositoryRoot, 'docs/app-privacy-review.md'),
      'utf8',
    );
    expect(privacyReview).toMatch(
      /\|\s*Device ID\s*\|\s*App Functionality \(EAS Update randomized installation token\)\s*\|\s*No\s*\|\s*No\s*\|/,
    );
  });
});
