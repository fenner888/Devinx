jest.mock('../../src/auth/keychain', () => ({
  loadCredentials: jest.fn(async () => ({
    apiKey: 'cog_example_12345678',
    orgId: 'org-example',
    attributionUserId: null,
    authKind: 'service_user',
  })),
  storeSecret: jest.fn(async () => undefined),
  wipeAllSecrets: jest.fn(async () => undefined),
}));

import { PatAuth } from '../../src/auth/PatAuth';
import { ServiceUserAuth } from '../../src/auth/ServiceUserAuth';

describe('credential fingerprints', () => {
  it('exposes only the final four service-key characters', async () => {
    await expect(new ServiceUserAuth().credentialFingerprint()).resolves.toBe('5678');
  });

  it('exposes only the final four PAT characters', async () => {
    await expect(new PatAuth().credentialFingerprint()).resolves.toBe('5678');
  });
});
