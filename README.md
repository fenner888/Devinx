# DevinX

Mobile mission control for Devin sessions. Unofficial, independent client for the Devin API — not affiliated with, endorsed by, or a product of Cognition AI.

## Status

Phase 0 (Foundation & Ground Truth) complete. See `/specs/000-build-spec.md` for the full build plan and `/specs/` for the design token audit and API deltas.

## Stack

- React Native + Expo (TypeScript strict)
- Expo Router (file-based, `devinx://` deep links)
- NativeWind (Tailwind for RN) wired to extracted Devin design tokens
- TanStack Query (polling, cache, retry) + Zustand (UI state)
- expo-secure-store (Keychain) + expo-sqlite (read cache)
- Sentry (secret-scrubbing beforeSend)

## Getting started

```bash
npm install --legacy-peer-deps
cp .env.example .env          # fill in EXPO_PUBLIC_* (never secrets)
npm run ios                   # or npm run android / npm run web
```

## Scripts

| Command | What it does |
|---|---|
| `npm run lint` | ESLint, zero warnings |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Jest (schemas, polling, sentry scrub, key-leak gate, tokens, branding) |
| `npm run build` | Typecheck gate (EAS build invoked separately) |
| `npm run audit` | `npm audit --audit-level=high` |
| `npm run ci` | lint → typecheck → test → build → audit (matches CI) |

## Security gates (spec §10)

- **§10.1** API key/PAT only in Keychain; CI grep gate blocks `cog_*` keys and key variable names outside `/src/auth`.
- **§10.2** Sentry `beforeSend` scrubs Authorization headers, key-shaped strings, and message bodies; network breadcrumbs disabled for `api.devin.ai`.
- **§10.5** Disconnect wipes Keychain + SQLite cache + query cache (test asserts empty).
- All API responses parsed through zod at the boundary (§8.3).

## Repo layout (spec §6)

```
src/
  app/                      Expo Router routes
  components/               pure UI (props only, no API imports)
  api/devin/                client, endpoints, zod schemas, types
  auth/                     AuthProvider strategies, Keychain (ONLY secrets touch)
  theme/                    tokens.ts (extracted), ThemeProvider
  store/                    Zustand slices (UI prefs, pins, watch list)
  lib/                      branding, sentry, polling policy, utils
  cache/                    sqlite cache layer
tests/                      mirrors src/
.github/workflows/ci.yml    lint → typecheck → test → build → npm audit + key-leak gate
```

## Design tokens

All colors, radii, type, and status vocabulary are extracted from the live `app.devin.ai` and `cognition.com` (2026-07-07). See `/specs/design-tokens.md` for the full audit and `/specs/reference-ui/` for screenshots. Raw hex appears ONLY in `/src/theme/tokens.ts`.
