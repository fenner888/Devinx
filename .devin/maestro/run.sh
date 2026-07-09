#!/usr/bin/env bash
set -euo pipefail

flow="${1:-}"
case "$flow" in
  onboarding)
    : "${DEVIN_API_KEY:?Set DEVIN_API_KEY}"
    : "${DEVIN_ORG_ID:?Set DEVIN_ORG_ID}"
    file=".devin/maestro/onboarding.yaml"
    ;;
  cloud-session)
    : "${E2E_PROMPT:?Set E2E_PROMPT}"
    : "${E2E_FOLLOW_UP:?Set E2E_FOLLOW_UP}"
    file=".devin/maestro/cloud-session.yaml"
    ;;
  disconnect-wipe)
    file=".devin/maestro/disconnect-wipe.yaml"
    ;;
  *)
    echo "Usage: $0 onboarding|cloud-session|disconnect-wipe" >&2
    exit 2
    ;;
esac

command -v maestro >/dev/null || {
  echo "Maestro is not installed: https://maestro.mobile.dev/getting-started/installing-maestro" >&2
  exit 1
}

maestro test "$file"
