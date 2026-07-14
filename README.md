# DevinX

Mobile mission control for Devin sessions. Unofficial, independent client for the Devin API — not affiliated with, endorsed by, or a product of Cognition AI.

## Status

The cloud mobile client and macOS-first Connector are implemented. Secure Tailscale pairing, per-device permissions, local session discovery/loading, authorized text steering, and per-computer disconnect are in the current source checkpoint. The Apple-silicon macOS Connector 0.1.0 is Developer ID signed, notarized, and available from the [official GitHub release](https://github.com/fenner888/Devinx/releases/latest).

## Cloud and computer connections

- **Devin Cloud:** connects from the iPhone to supported Devin Cloud APIs. Cloud-only users do not install DevinX Connector.
- **Computer:** requires Tailscale and DevinX Connector on the computer. **Cloud + Computer** combines both paths without copying computer credentials to the phone.

Tailscale and Connector are not substitutes for one another. Tailscale creates the private encrypted network route, but it does not run a server, expose Devin sessions, authorize the iPhone, or communicate with Devin for Terminal. DevinX Connector is the trusted local service that does those jobs. A Tailscale IP, server URL, or password is useful only when compatible server software is already installed and listening at that address.

## Stack

- React Native + Expo (TypeScript strict)
- Expo Router (file-based, `devinx://` deep links)
- NativeWind (Tailwind for RN) wired to extracted Devin design tokens
- TanStack Query (polling, cache, retry) + Zustand (UI state)
- expo-secure-store (Keychain) + expo-sqlite (read cache)
- Local-only diagnostic boundary (no crash-reporting or analytics SDK in v1)

## Getting started

```bash
npm ci
cp .env.example .env          # fill in EXPO_PUBLIC_* (never secrets)
npm run ios                   # or npm run android / npm run web
```

## Scripts

| Command                          | What it does                                                               |
| -------------------------------- | -------------------------------------------------------------------------- |
| `npm run lint`                   | ESLint, zero warnings                                                      |
| `npm run typecheck`              | `tsc --noEmit`                                                             |
| `npm run test`                   | Jest (schemas, polling, diagnostic scrub, key-leak gate, tokens, branding) |
| `npm run bridge:start -- --help` | Show safe Desktop Bridge setup and detected private Mac addresses          |
| `npm run build`                  | Typecheck gate (EAS build invoked separately)                              |
| `npm run audit`                  | `npm audit --audit-level=high`                                             |
| `npm run ci`                     | lint → typecheck → test → build → audit (matches CI)                       |

## DevinX Connector

The macOS Connector stores its identity and device grants in macOS Keychain and uses Tailscale-only transport in v1. Launch the packaged Connector, select the permissions for the iPhone, generate a short-lived QR code, and approve the named device locally. Read access and message sending are separate grants.

Users should install only the signed release from [GitHub Releases](https://github.com/fenner888/Devinx/releases/latest). The commands below are for source development, not normal installation.

```bash
npm run connector:build:macos
open "artifacts/connector/DevinX Connector.app"
```

After the QR code appears, open **Computer Connection** in DevinX on the iPhone and scan it. Approve only the expected device name. See `docs/devinx-connector.md`, `specs/020-tailscale-private-transport.md`, and `specs/023-authorized-local-session-steering.md` for the supported boundary.

## Security gates (spec §10)

- **§10.1** API key/PAT only in Keychain; CI grep gate blocks `cog_*` keys and key variable names outside `/src/auth`.
- **§10.2** No crash-reporting or analytics SDK ships in v1; the tested diagnostic boundary never logs or transmits errors, and its scrubber is required before any future provider integration.
- **§10.5** Disconnect wipes Keychain, SQLite/query caches, drafts, templates, and remembered session context.
- All API responses parsed through zod at the boundary (§8.3).

Report suspected vulnerabilities privately according to [SECURITY.md](SECURITY.md). Do not place
credentials, QR payloads, private session content, or working exploit details in a public issue.

## License

Original DevinX software and documentation are available under the [MIT License](LICENSE). See
[NOTICE](NOTICE) for the boundary around third-party dependencies, names, logos, screenshots,
reference material, and project trademarks.

## Repo layout (spec §6)

```
src/
  app/                      Expo Router routes
  components/               pure UI (props only, no API imports)
  api/devin/                client, endpoints, zod schemas, types
  auth/                     AuthProvider strategies, Keychain (ONLY secrets touch)
  theme/                    tokens.ts (extracted), ThemeProvider
  store/                    Zustand slices (UI prefs, pins, watch list)
  lib/                      branding, diagnostics, polling policy, utils
  cache/                    sqlite cache layer
tests/                      mirrors src/
.github/workflows/ci.yml    lint → typecheck → test → build → npm audit + key-leak gate
```

## Design tokens

All colors, radii, type, and status vocabulary are extracted from the live `app.devin.ai` and `cognition.com` (2026-07-07). See `/specs/design-tokens.md` for the full audit and `/specs/reference-ui/` for screenshots. Raw hex appears ONLY in `/src/theme/tokens.ts`.
