#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VOICE_DIR="$ROOT/spikes/voice"
OUT_DIR="${TMPDIR:-/tmp}/devinx-voice-benchmark"
DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export DEVELOPER_DIR

mkdir -p "$OUT_DIR/audio" "$OUT_DIR/transcripts" "$OUT_DIR/results"

xcrun swiftc \
  -parse-as-library \
  -framework Speech \
  -framework AVFAudio \
  "$VOICE_DIR/SpeechAnalyzerBenchmark.swift" \
  -o "$OUT_DIR/SpeechAnalyzerBenchmark"

for reference in "$VOICE_DIR"/fixtures/*.txt; do
  id="$(basename "$reference" .txt)"
  audio="$OUT_DIR/audio/$id.aiff"
  if [[ ! -f "$audio" ]]; then
    say -r 175 -f "$reference" -o "$audio"
  fi

  for mode in off on; do
    result="$OUT_DIR/results/$id-hints-$mode.json"
    if [[ "$mode" == "on" ]]; then
      /usr/bin/time -lp "$OUT_DIR/SpeechAnalyzerBenchmark" "$audio" \
        --hints-file "$VOICE_DIR/hints.txt" > "$result" 2> "$result.time"
    else
      /usr/bin/time -lp "$OUT_DIR/SpeechAnalyzerBenchmark" "$audio" \
        > "$result" 2> "$result.time"
    fi
    transcript="$OUT_DIR/transcripts/$id-hints-$mode.txt"
    /usr/bin/python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["transcript"])' \
      "$result" > "$transcript"
    node "$VOICE_DIR/score-wer.mjs" "$reference" "$transcript" \
      > "$OUT_DIR/results/$id-hints-$mode-wer.json"
  done
done

echo "$OUT_DIR"
