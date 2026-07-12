# Voice benchmark spike

Throwaway Session 4a assets. Nothing in this directory ships in the app.

## Record the fixtures

On the same iPhone 13-class device, record each file in `fixtures/` as a natural 30–90 second monologue. Use the same room, microphone route, distance, speaking pace, and OS build for every engine. Export 16 kHz mono PCM WAV where an engine requires it. Do not record real repository secrets or customer content.

Run every fixture through:

1. Apple SpeechAnalyzer/SpeechTranscriber, without and with the hint list.
2. `whisper.rn` using the exact candidate quantized model, without and with `initial_prompt`.
3. WhisperKit using the exact candidate Core ML model, without and with its prompt/context option if available.

Capture for each run: device model, OS/build, release build identifier, engine/version/model, cold or warm run, audio duration, finalization latency, peak resident memory from Xcode Instruments, transcript, interruption result, and whether audio/model files remain after completion. Repeat each fixture three times and report the median.

`SpeechAnalyzerBenchmark.swift` is a dependency-free file-transcription harness for Apple’s new API. `run-speech-analyzer-smoke.sh` compiles it with the active Xcode toolchain, generates synthetic macOS `say` audio, and writes smoke-test artifacts only to `$TMPDIR/devinx-voice-benchmark`. Those synthetic/Mac results validate the harness but are not the required natural-voice iPhone benchmark.

`build-ios-speech-analyzer-app.sh simulator` creates an ad-hoc simulator bundle. `build-ios-speech-analyzer-app.sh device` creates a development-signed bundle using Mark’s existing wildcard development profile; it does not touch the DevinX app or provisioning profile. The device bundle writes result JSON into its own Documents container so `devicectl` can retrieve it after a run.

When the paired phone is online and unlocked, `run-ios-device-benchmark.sh` builds, installs, executes every fixture with hints off/on, retrieves the private result container, and runs the same WER scorer. Set `AUDIO_DIR=/path/to/natural-recordings` to use matching `01-auth-refactor.wav` (or `.aiff`/`.m4a`) files; without it, the script uses synthetic audio only as a smoke check. Set `DEVICE` if the phone is not named `Marky`.

## Score a transcript

Requires only the repository's existing Node runtime:

```bash
node spikes/voice/score-wer.mjs \
  spikes/voice/fixtures/01-auth-refactor.txt \
  /path/to/engine-transcript.txt
```

The command reports substitutions, deletions, insertions, overall word error rate, and the developer terms from `manifest.json` that were missed. Store raw benchmark results outside the shipping source tree until Mark has reviewed them; copy only the reviewed aggregate table into `/specs/007-voice-spec-analysis.md`.

## Fairness rules

- Airplane mode must be enabled after any required model asset is installed.
- Revoke network access or inspect with a proxy to verify that audio bytes never leave the phone.
- Use release configuration; debug/Metro timings are invalid.
- Do not tune one fixture after seeing its transcript. The same capped hint string is used for all fixtures in a condition.
- A candidate fails the privacy gate if it makes any transcription network request.
