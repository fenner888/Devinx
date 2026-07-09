import { shouldShowPrivacyShield } from '../../src/components/PrivacyShield';

describe('app-switcher privacy shield', () => {
  it('covers native content whenever the app is not active', () => {
    expect(shouldShowPrivacyShield('background', 'ios')).toBe(true);
    expect(shouldShowPrivacyShield('inactive', 'ios')).toBe(true);
    expect(shouldShowPrivacyShield('active', 'ios')).toBe(false);
  });

  it('does not cover the web preview', () => {
    expect(shouldShowPrivacyShield('background', 'web')).toBe(false);
  });
});
