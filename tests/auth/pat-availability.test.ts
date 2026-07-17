import { isPatEnabled } from '../../src/auth/PatAuth';

describe('PAT availability gate', () => {
  const originalValue = process.env.EXPO_PUBLIC_ENABLE_PAT;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.EXPO_PUBLIC_ENABLE_PAT;
    } else {
      process.env.EXPO_PUBLIC_ENABLE_PAT = originalValue;
    }
  });

  it('stays hidden unless a release explicitly opts in', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_PAT;
    expect(isPatEnabled()).toBe(false);

    process.env.EXPO_PUBLIC_ENABLE_PAT = 'false';
    expect(isPatEnabled()).toBe(false);
  });

  it('is available only for the exact true flag', () => {
    process.env.EXPO_PUBLIC_ENABLE_PAT = 'true';
    expect(isPatEnabled()).toBe(true);

    process.env.EXPO_PUBLIC_ENABLE_PAT = 'TRUE';
    expect(isPatEnabled()).toBe(false);
  });
});
