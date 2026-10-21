# Phase 41 — Local-only Otterin

## Decision

The iPhone app is a Local-only companion named **Otterin**. Devin's official app covers Cloud workflows; Otterin focuses on paired-Mac coding sessions.

## Kept

- Local Home composer, paired-Mac/workspace/model pickers, on-device voice, and recent Local sessions.
- Local session search, history, live updates, prompts, approvals, and questions.
- Mac pairing and Connector permissions.
- Appearance, haptics, privacy, About, and wipe-all controls.
- `devinx://` deep links.

## Removed

- Cloud routes, authentication, session APIs, Cloud session controls, integrations, repositories, automations, and Cloud-only onboarding.
- Connection-mode selection and its persisted preference.
- Legacy Cloud Keychain credentials are deleted on launch and during wipe-all.

## Identity and continuity

- Name: Otterin.
- Subtitle: Local coding sessions, mobile.
- Preserve the existing slug, scheme, iOS bundle identifier/build number, Android package, and EAS project ID for TestFlight continuity.
- The Mac app name was initially unchanged; the Connector rename shipped in version 0.1.15.
