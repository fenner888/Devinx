# macOS Connector 0.1.7 release checklist

Status: release candidate. This checklist is complete only after the public artifact is installed and the child-exit scenario is re-verified from that installed build.

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

- [ ] Build the supported `arm64` architecture on macOS 13+.
- [ ] Seal every executable with the Developer ID Application identity and hardened runtime.
- [ ] Notarize and staple the app and DMG.
- [ ] Pass strict codesign, Gatekeeper, staple, checksum, embedded-runtime, entitlement, license, and clean-install verification.
- [ ] Publish a GitHub release newer than `connector-v0.1.5` with DMG and matching SHA-256 asset.
- [ ] Confirm the new release is GitHub `Latest` and its downloaded checksum matches independently.
- [ ] Confirm an affected installed build detects the newer public version and shows **Update available**.
- [ ] Download the public DMG and replace the installed app; this release does not auto-install.
- [ ] From the upgraded public app, force the embedded child to exit and confirm the app remains idle rather than entering the former EOF loop.
- [ ] Confirm the upgraded installed app can restart its child and preserve bounded Connector-owned cache and HTTP storage.

## User update boundary

The Connector checks GitHub Releases, shows **Update available**, and opens the official release page. It does not silently download or install an update. Existing 0.1.5 and private 0.1.6 users must quit Connector, download the new signed DMG, and replace the app in `/Applications` before they have this fix.
