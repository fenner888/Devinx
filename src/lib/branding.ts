/**
 * Branding constants — single source of truth for all name/scheme strings.
 * Spec §1.4: a rename is a one-line change here.
 *
 * Do NOT use Cognition's logo, Devin's logomark, or their mascot as DevinX
 * branding (spec §1.4 hard line). The narrow model-picker exception permits a
 * verified provider/model mark solely to identify a live catalog model.
 */

export const branding = {
  /** Product name. Fallbacks if Apple rejects the trademark: Cockpit | Dispatch | Overwatch. */
  name: 'DevinX',
  /** App Store subtitle (unofficial-client framing, spec §1.4). */
  subtitle: 'Unofficial client for Devin',
  /** Disclaimer shown on Welcome, Settings → About, and App Store listing. */
  disclaimer:
    'DevinX is an independent, unofficial client for the Devin API. Not affiliated with, endorsed by, or a product of Cognition AI.',
  /** Deep link scheme (spec §1.4). */
  scheme: 'devinx',
  /** Deep link prefix for building/validating URLs. */
  linkPrefix: 'devinx://',
  /** API key prefix for the service-user auth strategy. */
  serviceKeyPrefix: 'cog_',
  /** Org ID prefix. */
  orgIdPrefix: 'org-',
  /** Session ID prefix. */
  sessionIdPrefix: 'devin-',
  /** Keychain keys (spec §9 — ONLY these, nowhere else). */
  keychain: {
    apiKey: 'devin_api_key',
    orgId: 'devin_org_id',
    attributionUserId: 'attribution_user_id',
    authKind: 'auth_kind',
    pairedComputers: 'paired_computers_v1',
  },
  /** Fallback product names if Apple rejects "DevinX". */
  fallbackNames: ['Cockpit', 'Dispatch', 'Overwatch'] as const,
  /** Docs links shown in onboarding + settings. */
  links: {
    docs: 'https://docs.devin.ai',
    status: 'https://status.devin.ai',
    createServiceUser: 'https://docs.devin.ai/api-reference/api-keys',
    connectorReleases: 'https://github.com/fenner888/Devinx/releases/latest',
  },
} as const;

export type Branding = typeof branding;
