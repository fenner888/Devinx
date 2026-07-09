/**
 * AuthProvider strategy interface — spec §8.2.
 * v1 ships ServiceUserAuth; PatAuth is wired but flag-gated until PAT GA.
 */

export type AuthKind = 'service_user' | 'pat';

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: 'invalid_key' | 'missing_permission' | 'network'; detail: string };

export interface AuthProvider {
  readonly kind: AuthKind;
  /** Returns headers to merge into every request, e.g. { Authorization: 'Bearer cog_...' }. */
  authHeaders(): Promise<Record<string, string>>;
  /** Returns the org-scoped path prefix, e.g. '/v3/organizations/org-...'. */
  orgPath(): Promise<string>;
  /** Returns attribution params for session create / message send. */
  sessionAttribution(): Promise<{ create_as_user_id?: string }>;
  /** Returns only the final four credential characters for account identification. */
  credentialFingerprint(): Promise<string>;
  /** Cheap authenticated call to validate the key (spec §7.1 step 3). */
  validate(): Promise<ValidationResult>;
}

export class ApiSchemaError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly issues: unknown,
  ) {
    super(message);
    this.name = 'ApiSchemaError';
  }
}
