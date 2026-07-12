#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VOICE_DIR="$ROOT/spikes/voice"
OUT_DIR="${TMPDIR:-/tmp}/devinx-voice-device-results"
DEVICE="${DEVICE:-Marky}"
DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export DEVELOPER_DIR

APP="$("$VOICE_DIR/build-ios-speech-analyzer-app.sh" device)"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/console" "$OUT_DIR/documents" "$OUT_DIR/wer"

xcrun devicectl device install app --device "$DEVICE" "$APP"

for reference in "$VOICE_DIR"/fixtures/*.txt; do
  id="$(basename "$reference" .txt)"
  audio_name="$(find "$APP" -maxdepth 1 -type f \( -name "$id.aiff" -o -name "$id.wav" -o -name "$id.m4a" \) -exec basename {} \; -quit)"
  for mode in off on; do
    arguments=("$audio_name")
    if [[ "$mode" == "on" ]]; then
      arguments+=(--hints-file hints.txt)
    fi
    xcrun devicectl device process launch \
      --device "$DEVICE" \
      --terminate-existing \
      --console \
      --timeout 180 \
      com.fenner888.voicebenchmark "${arguments[@]}" \
      > "$OUT_DIR/console/$id-hints-$mode.log"
  done
done

xcrun devicectl device copy from \
  --device "$DEVICE" \
  --domain-type appDataContainer \
  --domain-identifier com.fenner888.voicebenchmark \
  --source Documents \
  --destination "$OUT_DIR/documents"

for result in "$OUT_DIR"/documents/*.json; do
  id_mode="$(basename "$result" .json)"
  id="${id_mode%-hints-*}"
  transcript="$OUT_DIR/$id_mode.txt"
  /usr/bin/python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["transcript"])' \
    "$result" > "$transcript"
  node "$VOICE_DIR/score-wer.mjs" "$VOICE_DIR/fixtures/$id.txt" "$transcript" \
    > "$OUT_DIR/wer/$id_mode.json"
done

echo "$OUT_DIR"
