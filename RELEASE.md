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
eas build --profile development --platform ios   # dev client on your device
eas build --profile preview --platform ios       # TestFlight-style internal build
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

## What's intentionally web-only (no API exists)

Ask mode, DeepWiki, model/agent selection, plan/quota bars, and enterprise
admin (SSO, IP allowlist, audit logs, member management). These have no public
API; the app links out where relevant.
