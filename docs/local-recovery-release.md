# Local recovery release checklist

## Source and root causes

Recovery branch: `devin/phase-6-local-recovery`, based on main `9f5bbd1`.
Build 81's local source is an older protocol-1 branch; installed Mac Connector
0.1.7 and main use protocol 2. User confirms camera decodes the QR but generic
pairing failure follows. The actual uploaded binary has not been extracted.

Live CLI 3000.10.27 returns 385 model variants across 48 families (176077 bytes).
The old 200-model bound rejected this response. Recovery keeps a 1 MiB response
bound and raises model count to 1000 consistently at CLI, bridge and mobile
validation boundaries. It still rejects duplicate IDs and invalid defaults.
Cold catalog reads now use the account command before the legacy session-load
fallback, avoiding needless session locks.

Mac QR codes now have an opaque quiet zone, an independent expiry display guard,
and disappear when the runtime stops. The runtime already refreshed expired
offers; the shell now also clears an expired pending-review view on a fresh
offer. In-flight approval keeps its separate lifetime. Local labels
are restored by using current source; persisted identifiers are unchanged.
Home Ready now requires successful Local discovery, not merely a saved pairing.

## ACP exposure audit

| Capability | Current exposure / remaining gap |
| --- | --- |
| List and load history | Implemented, consent-checked, paginated; fixture coverage and live list probe |
| Create / send / select model | Implemented with separate grants; live model catalog verified |
| Model cost / free / new metadata | CLI account catalog, validated; 385 live entries have cost metadata |
| Active work / questions | Existing activity and elicitation routes; physical retest pending |
| Follow-up during active work | ACP client currently rejects overlapping prompts as busy; queued steering is not established |
| General configuration and modes | Only model selection is wired; other advertised options need UI and authenticated routes |
| Tool permission requests | Currently cancelled fail-closed; explicit phone approval UI is not implemented |
| Cancel / delete / fork | Not exposed through current bridge; do not claim desktop parity |
| Image/audio prompt blocks, rich tool output | Local prompt currently text-only; history collector is text-oriented |
| Client file/terminal access | Not advertised; never enable implicitly to claim parity |

Protocol reference: https://agentclientprotocol.com/protocol/v1/session-config-options
requires dynamic session config handling. This audit is not a claim that every
capability the protocol defines is advertised by the installed Devin CLI.

## Reproducible iOS source gate

Before the final archive: fetch origin, review/commit changes, run
`node scripts/release/verify-ios-source.mjs`, retain its output with release
artifacts, then archive from this worktree. Do not archive from `repo`, which is
the divergent build-81 checkout. Recheck the source gate after archiving.

The current Xcode requires all pod targets to use a supported deployment target.
Archive with `IPHONEOS_DEPLOYMENT_TARGET=15.1` (the app's existing minimum),
`CURRENT_PROJECT_VERSION=82`, and `DEVELOPMENT_TEAM=Q7H78WYTAR`.

## Evidence / pending

- Baseline: 682/682 tests passed before changes.
- Native QR: decode at 360px on white and black backgrounds; expiry, repeat,
  invalidation, restart and oversize checks passed.
- Live account catalog after fix: 385 variants; default present; cost metadata
  on 385 entries. No session prompt or private session content logged.
- Dependency audit: patched xmldom, fast-uri and js-yaml; gate passes with the
  existing exact image-size build-tool exception (expires September 30).
- Final regression: 89 suites / 694 tests passed, including cross-boundary model
  catalog validation, pairing errors, native QR rendering, and child-exit soak.
  Typecheck and lint pass.
- Build 82 archived and exported successfully using Xcode. Camera purpose string
  retained. Final clean-source archive receipt still required before upload.
- Connector 0.1.8 Apple Silicon: Developer ID signed, app and DMG notarized and
  stapled, Gatekeeper/artifact verifier passed. DMG SHA-256:
  `99b3021565b18b933f313233bcecb2ac5987cfef61a9cceceac4a7b512914a18`.
- Installed physical-device pairing, publication, App Store Connect processing
  and tester assignment: pending. Do not describe the release as shipped until
  individually verified.

The existing Mac public release supports Apple Silicon. Intel cross-build/runtime
qualification and Windows Store repackaging are not established by this Mac run.
