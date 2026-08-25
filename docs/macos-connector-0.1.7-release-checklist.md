# macOS Connector 0.1.7 release checklist

Status: released and verified from the public artifact on 2026-08-25.

## Incident boundary

- Affected public release: `connector-v0.1.5`.
- Also affected: Mark's private 0.1.6 build.
- Trigger: the embedded Node child exits while stdout and stderr `FileHandle.readabilityHandler` callbacks remain installed.
- Observed impact: two `fd_monitoring` queues repeatedly call `availableData` at EOF and sustain about 198–199% CPU even though no child process remains.
- Storage was not the cause. Three samples held about 284 KiB of Connector cache plus 96 KiB of HTTP storage; the app was about 117 MiB. The prior 22.11 GiB cleanup was Codex child transcripts, not DevinX.

## Implementation gates

- [x] One supervisor owns the child process plus stdin, stdout, and stderr pipes.
- [x] EOF removes the corresponding readability handler and closes its read endpoint.
- [x] Normal termination, launch failure, explicit stop, and restart use the same idempotent cleanup path.
- [x] Cleanup removes both handlers, clears the termination callback, clears the active run, and closes every pipe endpoint.
- [x] Stderr remains drained but is not persisted or logged.
- [x] No package or project-owned file/log writer was added.

## Automated regression evidence

Command:

```bash
npm run connector:test:lifecycle
```

The executable Swift harness must prove:

- normal child exit drains stdout and stderr and removes both handlers;
- a missing executable cleans launch-time resources and a valid child can start afterward;
- explicit stop cleans resources and permits restart;
- 100 real child exit/restart cycles complete;
- callbacks remain unchanged during the idle observation windows;
- harness idle CPU is below 0.15 CPU-seconds per observation window;
- peak RSS growth stays below 64 MiB; and
- the isolated test directory grows by exactly zero bytes.

Observed pre-release harness result on 2026-08-25:

```text
PASS normal-exit launch-failure stop restart soak=100 idleCPU=0.0000s soakIdleCPU=0.0000s rssGrowth=1245184 diskGrowth=0
```

Full repository gate on 2026-08-25:

```text
Lint: passed
Typecheck: passed
Test Suites: 87 passed, 87 total
Tests: 675 passed, 675 total
App and bridge TypeScript build: passed
Dependency audit gate: passed with the repository's existing exact image-size build-toolchain advisory exception
```

## Artifact gates

- [x] Build the supported `arm64` architecture on macOS 13+.
- [x] Seal every executable with the Developer ID Application identity and hardened runtime.
- [x] Notarize and staple the app and DMG.
- [x] Pass strict codesign, Gatekeeper, staple, checksum, embedded-runtime, entitlement, license, and clean-install verification.
- [x] Publish a GitHub release newer than `connector-v0.1.5` with DMG and matching SHA-256 asset.
- [x] Confirm the new release is GitHub `Latest` and its downloaded checksum matches independently.
- [x] Confirm an affected installed build detects the newer public version and shows **Update available**.
- [x] Download the public DMG and replace the installed app; this release does not auto-install.
- [x] From the upgraded public app, force the embedded child to exit and confirm the app remains idle rather than entering the former EOF loop.
- [x] Confirm the upgraded installed app can restart its child and preserve bounded Connector-owned cache and HTTP storage.

## Published release evidence

- Source merge: `622bfc167ed7b58b03850dd4c24276a63d4074e4` (PR #73).
- Public release: <https://github.com/fenner888/Devinx/releases/tag/connector-v0.1.7>.
- Published state: GitHub `Latest`, not a draft or prerelease.
- Public DMG: `DevinX-Connector-0.1.7-macos-arm64.dmg`, 45,703,947 bytes.
- Public DMG SHA-256: `a3764478905ef02c0cbda3a831be25567b7a31543420d3f2714e2c0bcbba460a`.
- Fresh public download passed its published checksum, strict codesign, Gatekeeper (`Notarized Developer ID`), app and DMG staple validation, version `0.1.7` build `6`, and `arm64` architecture inspection.
- The affected installed private `0.1.6` build detected `connector-v0.1.7` after relaunch and displayed **Update available**.
- `/Applications/DevinX Connector.app` was replaced from the freshly downloaded public DMG, then independently passed codesign, Gatekeeper, and staple validation.

Installed public-build child-exit verification:

```text
20 idle samples after child exit: CPU 0.0% throughout
RSS: 99,808 KiB throughout
Remaining child processes: 0 throughout
Connector cache + HTTP storage: 452 KiB -> 452 KiB (0 KiB growth)
```

Five-cycle installed-public restart soak:

```text
cycle 1: child seen, remaining children 0, CPU 0.0%, RSS 97,232 KiB
cycle 2: child seen, remaining children 0, CPU 0.0%, RSS 97,072 KiB
cycle 3: child seen, remaining children 0, CPU 0.0%, RSS 97,120 KiB
cycle 4: child seen, remaining children 0, CPU 0.0%, RSS 96,992 KiB
cycle 5: child seen, remaining children 0, CPU 0.0%, RSS 97,232 KiB
Connector cache + HTTP storage: 516 KiB -> 516 KiB (0 KiB growth)
```

Each restart launched the embedded `runtime/node` child, each child exited, and the installed Connector returned to idle without an `fd_monitoring` CPU loop.

## User update boundary

The Connector checks GitHub Releases, shows **Update available**, and opens the official release page. It does not silently download or install an update. Existing 0.1.5 and private 0.1.6 users must quit Connector, download the new signed DMG, and replace the app in `/Applications` before they have this fix.
