/**
 * Branding constants — single source of truth for all name/scheme strings.
 * Spec §1.4: a rename is a one-line change here.
 *
 * Do NOT use Cognition's logo, Devin's logomark, or their mascot as Otterin
 * branding. The model-picker exception permits a
 * verified provider/model mark solely to identify a live catalog model.
 */

export const branding = {
  /** Product name. */
  name: 'Otterin',
  /** App Store subtitle. */
  subtitle: 'Local coding sessions, mobile',
  /** Disclaimer shown on Welcome, Settings → About, and App Store listing. */
  disclaimer:
    'Otterin is an independent, unofficial companion app for Devin for Terminal. Not affiliated with, endorsed by, or a product of Cognition AI.',
  /** Deep link scheme (spec §1.4). */
  scheme: 'devinx',
  /** Deep link prefix for building/validating URLs. */
  linkPrefix: 'devinx://',
  /** Paired-device key and legacy Cloud credential names retained for cleanup. */
  keychain: {
    apiKey: 'devin_api_key',
    orgId: 'devin_org_id',
    attributionUserId: 'attribution_user_id',
    authKind: 'auth_kind',
    pairedComputers: 'paired_computers_v1',
  },
  /** Links shown in settings and local pairing. */
  links: {
    docs: 'https://docs.devin.ai',
    status: 'https://status.devin.ai',
    connectorReleases: 'https://github.com/fenner888/Otterin/releases/latest',
    windowsConnectorStore: 'https://apps.microsoft.com/detail/9N52Z3FVMFH8',
  },
} as const;

export type Branding = typeof branding;
