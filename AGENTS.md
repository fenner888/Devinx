# Otterin (DevinX repo) — Agent shared context

- TypeScript strict. No raw hex outside `src/theme/tokens.ts`.
- Secrets (API key, org ID, attribution user ID) ONLY in `/src/auth` via expo-secure-store. Nowhere else. CI grep gate enforces this.
- Local bridge requests and replies parse through Zod at their boundaries (`bridge/src/schemas.ts` and `src/auth/computerBridge.ts`). Unknown fields pass through where intended; strict schemas reject unsupported shapes.
- Follow `/specs/` — the build spec (`000-build-spec.md`), design tokens (`design-tokens.md`), API deltas (`api-deltas.md`), and parity deltas (`parity-deltas.md`) are the source of truth.
- Status labels use the exact vocabulary from `tokens.ts` (`statusLabels`). Never invent status wording.
- Every PR: CI green + side-by-side parity screenshots per §5.4.6.
- Branch convention: `devin/phase-N-*`, one PR per phase.
