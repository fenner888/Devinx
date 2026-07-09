# Releasing DevinX

Everything code-side is done. The remaining steps require **your** Expo and
Sentry accounts — they can't be created from the repo. Each is one command.

## 1. EAS project (required for device/store builds + push tokens)

```bash
npm i -g eas-cli
eas login
eas init                    # creates the EAS project, writes extra.eas.projectId into app.json
```

After `eas init`, `app.json` → `expo.extra.eas.projectId` will be filled in.
Push-token registration (`getPushToken`) starts working the moment that id
exists — until then it no-ops by design.

Set the OTA updates URL (printed by `eas init`, or from the Expo dashboard):

```json
// app.json → expo.updates
"url": "https://u.expo.dev/<your-project-id>"
```

Builds:

```bash
eas build --profile development --platform ios             # dev client on your device
eas build --profile development-simulator --platform ios   # local iOS simulator
eas build --profile preview --platform ios                 # TestFlight-style internal build
eas build --profile production --platform all     # store builds
eas submit --profile production                    # upload to App Store / Play
```

Build profiles are defined in `eas.json`.

## 2. Sentry (optional, for crash/error reporting)

1. Create a project at sentry.io (React Native).
2. Put the DSN in `.env`:

```
EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

Until a DSN is set, `initSentry()` is a no-op (safe for dev). The
secret-scrubbing `beforeSend` is already wired.

## 3. Push notifications (optional, self-hosted)

The Devin API has no push, and iOS can't poll in the background, so pushes need
a small always-on service. `scripts/notifier/index.mjs` is exactly that —
it polls sessions and sends Expo pushes when one needs your input or finishes.

```bash
DEVIN_API_KEY=cog_... DEVIN_ORG_ID=org-... \
EXPO_PUSH_TOKENS='ExponentPushToken[...],ExponentPushToken[...]' \
node scripts/notifier/index.mjs
```

Device tokens come from the app (`getPushToken()` after step 1). Persist them
however you like (a file, a KV store) and pass them in via `EXPO_PUSH_TOKENS`.
Run it on any cheap VM / Pi / cron box. Everyone who wants pushes runs it;
everyone else loses nothing.

## 4. Pre-flight

```bash
npm run ci      # lint → typecheck → test → build → audit
```

## 5. Device E2E

Run the onboarding flow against a development or preview build without committing credentials:

```bash
DEVIN_API_KEY='cog_...' DEVIN_ORG_ID='org-...' \
  .devin/maestro/run.sh onboarding

E2E_PROMPT='Create a short plan for this repository. Do not modify files.' \
E2E_FOLLOW_UP='Summarize the plan in one sentence.' \
  .devin/maestro/run.sh cloud-session
```

Run the destructive wipe flow only on a test credential because it removes the device's stored connection:

```bash
.devin/maestro/run.sh disconnect-wipe
```

## 6. App Store metadata draft

**Name:** DevinX

**Subtitle:** Unofficial mission control for Devin sessions

**Keywords:** Devin,developer,AI,coding,sessions,monitor,cloud,engineering,workflow

**Promotional text:** Monitor, steer, and start Devin Cloud sessions from your phone.

**Description:**

> DevinX is a mobile mission-control client for the Devin API. Monitor active cloud sessions, surface work that needs your input, send follow-up messages, review pull requests and insights, create sessions with repository and attachment context, and track usage from your phone.
>
> Your API credential stays in the device Keychain. App traffic goes directly to the Devin API without an intermediary DevinX backend.
>
> DevinX is an independent, unofficial client for the Devin API. Not affiliated with, endorsed by, or a product of Cognition AI.

**Review notes:**

> This app requires an existing Devin account and a user-provided Devin API credential. Credentials are entered at runtime and stored in the iOS Keychain. The app is an independent API client and does not use Cognition or Devin logos. A test credential must be supplied privately in App Store Connect review notes; never commit it to this repository.

**Privacy labels draft:**

- User Content: collected only to provide app functionality; not linked by DevinX; sent directly to the Devin API
- Identifiers: organization and account identifiers used for app functionality
- Diagnostics: crash data only when Sentry is configured
- Tracking: no
- Data sale: no

**Required URLs:**

- Support: `https://github.com/fenner888/Devinx/issues`
- Privacy policy: publish `PRIVACY.md` at a stable public HTTPS URL before submission

**Screenshot set:**

1. Home composer with repository and mode context
2. Blocked-first Sessions board
3. Active session timeline with attachment composer
4. Pull request / Changes tab
5. Usage and analytics
6. Privacy and secure-storage explanation

## What's intentionally web-only (no API exists)

Ask mode, DeepWiki, model/agent selection, plan/quota bars, and enterprise
admin (SSO, IP allowlist, audit logs, member management). These have no public
API; the app links out where relevant.
