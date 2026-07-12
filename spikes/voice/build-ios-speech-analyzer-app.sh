#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-simulator}"
if [[ "$MODE" != "simulator" && "$MODE" != "device" ]]; then
  echo "Usage: $0 [simulator|device]" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VOICE_DIR="$ROOT/spikes/voice"
OUT_DIR="${TMPDIR:-/tmp}/devinx-voice-ios-$MODE"
APP="$OUT_DIR/VoiceBenchmark.app"
DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export DEVELOPER_DIR

rm -rf "$OUT_DIR"
mkdir -p "$APP"
cp "$VOICE_DIR/ios-benchmark-Info.plist" "$APP/Info.plist"
cp "$VOICE_DIR/hints.txt" "$APP/hints.txt"

for reference in "$VOICE_DIR"/fixtures/*.txt; do
  id="$(basename "$reference" .txt)"
  if [[ -n "${AUDIO_DIR:-}" ]]; then
    source_audio="$(find "$AUDIO_DIR" -maxdepth 1 -type f \( -name "$id.aiff" -o -name "$id.wav" -o -name "$id.m4a" \) -print -quit)"
    if [[ -z "$source_audio" ]]; then
      echo "Missing natural recording for $id in $AUDIO_DIR" >&2
      exit 1
    fi
    cp "$source_audio" "$APP/$(basename "$source_audio")"
  else
    say -r 175 -f "$reference" -o "$APP/$id.aiff"
  fi
done

if [[ "$MODE" == "simulator" ]]; then
  SDK="$(xcrun --sdk iphonesimulator --show-sdk-path)"
  TARGET="arm64-apple-ios26.0-simulator"
else
  SDK="$(xcrun --sdk iphoneos --show-sdk-path)"
  TARGET="arm64-apple-ios26.0"
fi

xcrun swiftc \
  -parse-as-library \
  -target "$TARGET" \
  -sdk "$SDK" \
  -framework Speech \
  -framework AVFAudio \
  "$VOICE_DIR/SpeechAnalyzerBenchmark.swift" \
  -o "$APP/VoiceBenchmark"

if [[ "$MODE" == "device" ]]; then
  PROFILE="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/bfdc2987-500e-490c-be38-76b5c2ea7dc7.mobileprovision"
  cp "$PROFILE" "$APP/embedded.mobileprovision"
  codesign --force --sign "Apple Development: Mark Fenner (RVKHTJ3FLV)" \
    --entitlements "$VOICE_DIR/ios-benchmark.entitlements" \
    --timestamp=none "$APP"
else
  codesign --force --sign - --timestamp=none "$APP"
fi

echo "$APP"
