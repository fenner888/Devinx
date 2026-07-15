# Privacy policy publication handoff

Prepared: July 14, 2026

This handoff freezes the privacy policy that matches the installed Build `0.1.0 (67)`. It does not
authorize publishing the policy, publishing App Store privacy answers, submitting App Review, or
releasing the app.

## Frozen source

- Repository file: `PRIVACY.md`
- Effective date: July 11, 2026
- SHA-256: `d02f2e13ff1f25d2e3f0652c3403697824146f04fe86c7e1ecbf78cbf3c50f73`
- Intended public URL: `https://github.com/fenner888/Devinx/blob/main/PRIVACY.md`

The current `origin/main:PRIVACY.md` has SHA-256
`cdbb0b0ae21017041659c1c69a402d609db6fdd8a8ac02007aea21a4bf7c6c91` and is materially older.
It omits the Build 67 disclosures for on-device voice, paired-computer access, Tailscale transport,
EAS Update delivery metadata, and the current no-analytics/no-crash-reporting/no-push state.

## Required publication sequence

1. Owner approves publishing the frozen file above.
2. Merge that exact file to the public repository's `main` branch without editing it in the browser.
3. Fetch the raw public file and verify its SHA-256 equals the frozen checksum.
4. Reconcile the unpublished App Store privacy answers with `docs/app-privacy-review.md` and Build
   67 one final time.
5. Publish the App Store privacy answers only after the public policy verification succeeds.

## Verification command

```bash
curl --fail --silent --show-error \
  https://raw.githubusercontent.com/fenner888/Devinx/main/PRIVACY.md \
  | shasum -a 256
```

Expected digest after publication:

```text
d02f2e13ff1f25d2e3f0652c3403697824146f04fe86c7e1ecbf78cbf3c50f73
```

