# DevinX Configuration Hub

**Status:** Implemented; release validation in progress
**Scope:** Mobile Configuration Hub, reusable launch profiles, Cloud environment assistant,
local-device profiles, and Action Center
**Security posture:** Public documented Devin APIs and signed Connector capabilities only

## 1. Product promise

> Configure once. Launch and steer from anywhere.

DevinX is a mobile control plane, not a clone of every Devin web administration page. The
Configuration Hub exposes settings that materially affect mobile session creation and steering,
while making the execution boundary explicit:

- **Devin Cloud** resources are organization-scoped and authorized by the connected service user.
- **Local-device** resources are machine-scoped and available only when DevinX Connector advertises
  the corresponding signed capability.
- A control is never rendered as functional merely because the Devin web UI contains a similar
  control.

## 2. Information architecture

Settings contains these top-level groups:

1. **My defaults** — reusable launch profiles and default tags.
2. **Devin Cloud** — repositories, environment setup, knowledge, playbooks, automations, secrets,
   usage, integrations status, Review, and supported Security work.
3. **Local devices** — paired devices, connection health, transport, grants, advertised capabilities,
   Connector startup guidance, and approved workspaces discovered from local sessions.
4. **Action Center** — Cloud work and local-device reachability requiring attention.
5. Existing appearance, behavior, privacy, account, about, and verified disconnect controls.

Cloud administration rows are shown only when Cloud is connected and active in the selected
connection mode. Action Center is the deliberate exception: it summarizes every configured source
even when the home feed is filtered. Permission failures show a truthful unavailable state and
never crash the screen. Each local-device row is derived from a live signed health response plus the
local device grant.

## 3. Reusable launch profiles

Launch profiles are non-sensitive, device-local composer defaults. A profile contains:

```ts
type LaunchTarget = 'cloud';

interface CloudLaunchDefaults {
  repositoryPaths: string[];
  mode: DevinMode;
  playbookId?: string;
  knowledgeIds: string[];
  secretIds: string[]; // IDs only, never values
  tags: string[];
  maxAcuLimit?: number;
}

```

The current documented session-create contract does not expose an `unlisted` field. DevinX does
not persist or submit that setting unless it is added to the supported public API and typed client.

Security rules:

- Profiles never store API keys, secret values, environment-variable values, cookies, shell
  commands, arbitrary filesystem paths, or session message content.
- Cloud and local-device profiles remain distinct; incompatible fields never migrate silently.
- Applying a profile is explicit and visible in the composer.
- Deleting a referenced Cloud resource degrades gracefully to an unselected field.

This release creates and applies Cloud profiles only. Local-device profiles remain read-only
summaries until local session creation and configuration methods are part of the signed Connector
protocol; a future local launch-profile schema must be specified and reviewed with those methods.

## 4. Cloud Configuration Hub

Native management uses only the existing typed, Zod-validated public endpoints:

- Repositories: list available repositories, show indexing state, request indexing.
- Knowledge: list/create/update/delete.
- Playbooks: list/create/update/delete.
- Automations: list/create/update/delete/enable/disable schedules.
- Secrets: list metadata, create, delete; values are write-only and cleared immediately.
- Usage and analytics: permission-gated read views.
- Review and Security: only backed by their supported API/session origin gates.

### 4.1 Environment assistant

Cloud environment blueprints and snapshot builds are organization-wide and do not have a
documented public CRUD API in the current reference. DevinX must not call private web endpoints or
reuse browser cookies.

Instead, **Environment setup** creates a normal, clearly labeled Devin session using the public
session API. The user selects an accessible repository and supplies:

- required runtimes/tools;
- dependency/bootstrap commands;
- lint, typecheck, test, and run commands;
- constraints and non-goals.

DevinX builds a previewable prompt instructing Devin to inspect the current environment and guide
or perform only supported environment-configuration work. The user confirms before creating the
session. The resulting session is tracked normally. DevinX never claims that the active snapshot
changed unless the session result explicitly confirms it.

### 4.2 Integrations and MCP

The official Devin MCP surface currently documents integration listing/status but not a complete
native install/edit contract for every provider. The v1 Configuration Hub may show verified
installation status and the provider's authenticated authorization URL when returned by the
official service. OAuth still occurs in a secure browser session. DevinX must not collect provider
credentials or implement guessed provider-specific forms.

## 5. Local-device profiles

Local-device Profile displays:

- computer name, private transport, pairing age, and live reachability;
- individual device grants;
- Connector-reported session list/load/steering capabilities;
- workspaces observed through authorized session metadata;
- Connector setup/start-at-login guidance, with secure revoke/disconnect managed from Computers.

Future controls may include repository listing, secret saving, session archive, deployment
approval, interactive browser attachment, models, modes, permissions, and MCP status only after
the Connector implements a versioned request method, per-method grant, rate limit, Zod request and
response schemas, generic unauthorized 404 behavior, desktop approval where needed, and tests.

Explicitly forbidden:

- arbitrary command execution from Settings;
- arbitrary path entry or traversal;
- generic environment-variable editing;
- reading secret values back to the phone;
- assuming ACP features from a CLI version string;
- showing enabled controls for unadvertised methods.

## 6. Action Center

Action Center is a derived inbox, not a new backend. It combines:

- Cloud sessions waiting for user input or approval;
- Cloud sessions in error, usage-limit, or quota states;
- watched Cloud sessions completed since the last local acknowledgement;
- unreachable or authorization-failed local-device connections.

The current signed session-summary schema does not expose an actionable session-status field.
Local sessions therefore do not appear as waiting/approval items until a versioned Connector
protocol adds that field and its authorization rules.

Items contain only already-authorized metadata and deep-link to their existing detail or settings
screen. Dismissal/acknowledgement is device-local. No prompt or message content is copied into
analytics or notifications.

## 7. Authorization and disclosure

- Every API response is Zod-parsed at the boundary.
- Cloud write controls rely on server-side service-user authorization; client gates are UX only.
- Missing permissions display the documented permission name when determinable.
- Unauthorized or out-of-scope resources preserve generic 404 non-disclosure.
- All write actions validate input and require confirmation when destructive.
- No enterprise endpoint, private web endpoint, service-account impersonation, browser cookie, or
  hardcoded secret may be introduced.

## 8. Rollout phases

### Phase A — coherent hub

- Reorganize Settings into My defaults, Cloud, Local devices, and Action Center.
- Add Automations and Repositories to Settings.
- Surface existing repository management and add Local-device Profile screens.
- Add permission-aware descriptions and unavailable states.

### Phase B — launch profiles and environment assistant

- Add Cloud launch-profile CRUD and composer application.
- Add environment-assistant prompt preview and session creation.
- Add profile reference cleanup and tests.

### Phase C — action center

- Add derived Cloud attention items.
- Add local-device reachability/action items from signed capabilities.
- Add acknowledgement state and deep links.

### Phase D — expanded local capabilities

- Separate protocol/spec/authorization review for every new Connector mutation.
- Do not include a local control until the signed method and desktop approval path are complete.

## 9. Validation

- Unit: profile normalization/migration, environment prompt assembly, action derivation, capability
  labels, secret exclusion.
- Integration: all Cloud resource permission failures, repository indexing, session creation,
  Connector health and revoked/unreachable behavior.
- Security: persisted-profile secret scan, endpoint authorization matrix, generic 404 tests,
  Connector replay/rate-limit tests, Sentry scrub coverage.
- UI: light/dark, keyboard, empty/locked/offline states, VoiceOver, Dynamic Type, Reduce Motion.
- Release: lint, typecheck, full tests, dependency audit, secret scan, parity screenshots, then a
  separately approved TestFlight build.
