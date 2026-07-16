# 034 — Connection Recovery and Local Steering Accuracy

**Status:** Approved implementation contract
**Scope:** iOS paired-computer recovery, combined-mode continuity, and local steering errors

## Problem

Build 67 can leave the iPhone and Connector in different pairing states. A remotely revoked
device remains visible on the phone, cannot be disconnected, and cannot be paired again because
the stale credential is always treated as an endpoint migration. Removing the last computer while
Cloud + Computer mode is selected can also send a still-authenticated cloud user back through
onboarding. Separately, Connector cleanup after a completed prompt can briefly reject the next
prompt as busy while the app reports the rejection as a steering-permission failure.

## Required behavior

1. **Revocation is idempotent on the phone.** A `404` from `device.revoke` means the Mac has
   already revoked or forgotten that device. DevinX must delete only the matching local registry
   entry and signing key and report disconnect success. Other failures must preserve the local
   credential so the user can retry.
2. **A revoked device can pair again.** When a new QR code has the exact same bridge identity and
   the stored credential fails verification with `authorization_failed`, DevinX must delete only
   that stale credential and its device signing key, then execute the normal approval-based fresh
   pairing flow. Identity mismatches and transport failures must never replace an existing pairing.
3. **Cloud access survives computer removal.** If Cloud + Computer mode loses its last computer
   while valid cloud credentials remain, the app must switch to Cloud mode before connection
   loading completes. It must not display onboarding during the transition. Computer-only mode
   remains unconfigured when its last computer is removed.
4. **Busy is not an authorization error.** The Connector must distinguish a prompt that conflicts
   with an active prompt from an unavailable runtime. The public response contains no internal
   details. The mobile app must keep the draft, avoid blind automatic retries, and explain that
   Devin is finishing the previous turn. Permission, revocation, rate-limit, and availability
   failures each receive accurate user-facing copy.
5. **Sending respects live activity.** A session with reported active work must not accept another
   prompt until the active turn finishes. This is a UI guard in addition to the Connector's
   authoritative server-side conflict check.

## Security invariants

- Every protected Connector request remains signature-verified, device-authorized, permission
  checked, rate limited, and schema validated.
- Unauthorized or revoked devices continue to receive generic `404` responses.
- Stale recovery is permitted only after exact bridge-identity equality and a verified
  authorization failure; it never trusts an endpoint or QR code alone.
- No credential, pairing secret, request content, or internal runtime error is logged or returned.
- No prompt is automatically retried after an ambiguous network response.

## Verification

- Unit tests cover already-revoked disconnect, non-authorization disconnect failure, stale
  same-identity re-pairing, identity mismatch, combined-mode fallback, computer-only behavior,
  Connector busy mapping, and mobile error copy.
- Existing authorization, replay, cross-device, rate-limit, secret-scan, dependency-audit, lint,
  typecheck, and test suites must remain green before distribution.
