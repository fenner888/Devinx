# Session 4a — Voice Spec Analysis

**Date:** July 12, 2026  
**Status:** Approved for Session 4b; Whisper deferred to a later build
**Decision authority:** Mark Fenner  
**Build gate:** Session 4b is authorized. It cannot merge or ship until the security and lifecycle evidence in §9 is complete.

## 1. Executive decision

Proceed with Session 4b using the app-owned SpeechAnalyzer module. A natural-voice TestFlight benchmark establishes that Apple SpeechAnalyzer is available, fast, memory-stable across the five fixtures, and strong enough for the v1 starting point. The decision explicitly accepts the measured developer-vocabulary tradeoff for v1: hints produced byte-for-byte identical transcripts, and 7 of 20 tracked technical terms were not preserved exactly. Whisper remains a later accuracy/compatibility option rather than a v1 dependency.

The provisional architecture is:

- **Approved primary:** a small DevinX-owned iOS Expo module around Apple `SpeechAnalyzer` + `SpeechTranscriber` on iOS 26. On the tested iPhone 16 Pro, mean overall WER was 9.01%, median post-recording file analysis was 0.946 seconds without hints, and peak observed app resident memory was 129.7 MiB.
- **V1 fallback:** ordinary editable text input plus a clear voice-unavailable explanation when SpeechAnalyzer or its locale asset is unavailable. `whisper.rn` and WhisperKit are deferred to a later build and are not v1 dependencies.
- **Do not select:** the current `expo-speech-recognition` wrapper as the new-API candidate. It explicitly implements legacy `SFSpeechRecognizer`, not SpeechAnalyzer.
- **Approved scribe architecture:** Apple Foundation Models on eligible Apple Intelligence devices after a quality check, with the deterministic template implementation on every device. The template path is mandatory and cloud scribe remains out of v1.
- **Privacy:** audio stays on device. No voice implementation may import networking, retain recordings, log transcripts, or change the App Store “Data Not Collected” posture.

This decision overturns “install `whisper.rn` first” for v1. Apple’s engine removes a third-party native binary and Whisper model, supplies live finalized results, and uses system-managed language assets. The benchmark proves availability on an iPhone 16 Pro and shows no measurable contextual-string benefit in the file-analysis path. The shipping module must retain the app’s existing deployment floor, compile SpeechAnalyzer behind iOS 26 availability checks, and never raise the entire app’s minimum OS merely to enable voice. Apple reports iOS 26 on 79% of active iPhones as of June 7, 2026. [Apple SpeechAnalyzer session](https://developer.apple.com/videos/play/wwdc2025/277/) · [Apple OS adoption](https://developer.apple.com/support/app-store/)

## 2. Repository baseline

- Expo SDK 54, React Native 0.81.5, TypeScript strict, New Architecture enabled.
- Native changes already ship through EAS/TestFlight. Expo Go cannot exercise the selected candidates.
- The isolated TestFlight benchmark proved the Expo Audio plugin must receive the microphone copy directly or it overwrites `infoPlist` with a generic default. Session 4b must configure the plugin and verify the archived IPA contains exactly: “DevinX uses the microphone to transcribe your voice into session prompts. Audio is processed entirely on your device and never uploaded.”
- The app already has `expo-audio`, but that is not a reason to couple UI to an engine. The approved `TranscriptionEngine` owns capture/transcription lifecycle behind an interface.
- A local Swift module is an established Expo path and is autolinked from the application; it does not need to be published as an npm package. [Expo local-module guide](https://docs.expo.dev/modules/get-started/)

## 3. Candidate evaluation

### 3.1 Apple SpeechAnalyzer/SpeechTranscriber via local Expo module

**Fit:** best provisional fit for iOS 26. Apple describes live transcription as a `SpeechTranscriber` module feeding `SpeechAnalyzer`, with volatile and finalized results delivered asynchronously. The app must check supported/installed locales, reserve/install the required system asset, and handle asset progress and availability. `AnalysisContext.contextualStrings` is the vocabulary-bias mechanism. [Apple SpeechAnalyzer session](https://developer.apple.com/videos/play/wwdc2025/277/)

**Advantages**

- Entirely on device and system-managed; no app-bundled Whisper model.
- Streaming/finalized-result semantics map directly to the approved composer UX.
- Contextual strings cover repository, playbook, tag, and developer vocabulary hints.
- A focused local Expo module avoids a new third-party npm runtime dependency and supports React Native’s New Architecture through Expo Modules.

**Risks / unknowns**

- iOS 26 only; `SpeechTranscriber.isAvailable` must be measured on the iPhone 13-class target, not inferred from OS adoption.
- Swift module must own `AVAudioSession`/`AVAudioEngine`, interruption/background handling, AirPods routing, model asset installation, cursor-safe result events, and protected cleanup.
- The iPhone 16 Pro TestFlight benchmark is complete. The iPhone 13-class availability/performance floor, live-streaming behavior, and interruption matrix remain unmeasured.

**Estimated implementation after approval:** 5–8 engineering days plus device QA. This includes the local module, event contract, audio route/interruption handling, asset progress, file protection tests, and a release-build benchmark harness; it excludes the React Native UI and scribe work.

### 3.2 `whisper.rn`

**Dependency hygiene verified July 12, 2026:** npm `whisper.rn` 0.6.0, genuine GitHub repository, 37,898 npm downloads in the preceding month, 22.96 MB unpacked package, MIT license, and recent repository activity. Its only runtime dependency is `safe-buffer`; React and React Native are peers. The repository documents iPhone 13 Pro Max testing, prebuilt iOS XCFramework use, Core ML, VAD, file transcription, and Expo prebuild. It does **not** currently contain the Expo config plugin assumed in the addendum; Expo use is a native prebuild/pod integration. [npm package](https://www.npmjs.com/package/whisper.rn) · [source repository](https://github.com/mybigday/whisper.rn)

**Advantages**

- Runs Whisper locally across older iOS versions and has an existing React Native API.
- `initial_prompt` can bias developer vocabulary.
- Core ML acceleration and quantized whisper.cpp models are available.

**Risks**

- Adds a large native framework plus model assets and makes model download/storage/cleanup a DevinX responsibility.
- The public API is primarily file/chunk transcription rather than SpeechAnalyzer-style continuously revised text; streaming UX and interruption behavior require app orchestration.
- Current issue traffic includes memory termination, device/Metal variation, release-only model loading, long-audio, background, and Expo build reports. These are benchmark targets, not reasons to dismiss the package without testing.
- Installing it now would violate the analysis-first gate.

**Estimated implementation after approval:** 4–7 engineering days plus device QA, assuming the prebuilt framework works with the current EAS toolchain; 7–10 if a maintained config/plugin or source-build customization is required.

### 3.3 WhisperKit

WhisperKit now lives in Argmax’s `argmax-oss-swift` repository. It is Swift-native, Core ML-oriented, streams microphone input, automatically downloads a device-recommended model, and supports prompt guidance. The open-source repository recommends a 626 MB large-v3 asset for maximum quality and tiny for debugging. [Argmax open-source SDK](https://github.com/argmaxinc/argmax-oss-swift)

**Advantages:** strong Apple-silicon optimization, Swift API, model management primitives, and likely highest ceiling for local Whisper quality.

**Costs:** another custom Expo bridge, a Swift Package dependency, materially larger candidate models, iOS-only integration, and a larger test/support surface. The open-source/Pro split must be checked carefully for any feature relied upon by the UX.

**Estimated implementation after approval:** 8–13 engineering days plus device QA. It should win only if it reduces technical-term WER by at least 20% relative to the next candidate while staying inside the memory and real-time gates.

### 3.4 `expo-speech-recognition`

**Dependency hygiene verified July 12, 2026:** npm 56.0.1, 2,208,219 downloads in the preceding month, 538 KB unpacked, real active GitHub repository, Expo config plugin, and an SDK-54 release channel. However, its own documentation says its iOS implementation is `SFSpeechRecognizer`. It offers interim results, on-device flags, contextual strings, audio capture, and metering, but it is not a wrapper for Apple’s new SpeechAnalyzer API. [Source and compatibility table](https://github.com/jamsch/expo-speech-recognition)

**Decision:** reject it as the “new SpeechAnalyzer” candidate. It may be kept only as an emergency spike comparator; it cannot silently become v1 because its privacy/network behavior depends on mode and system support.

## 4. Model packaging decision

Verified quantized whisper.cpp English model payloads:

| Model | Quantized file | Approximate payload | Decision use |
|---|---:|---:|---|
| `tiny.en` q5_1 | `ggml-tiny.en-q5_1.bin` | 30.7 MB | possible instant fallback only |
| `base.en` q5_1 | `ggml-base.en-q5_1.bin` | 57.0 MB | provisional accuracy download |
| `small.en` q5_1 | `ggml-small.en-q5_1.bin` | 181.3 MB | reject unless benchmark proves necessary |

Source artifacts: [whisper.cpp models](https://huggingface.co/ggerganov/whisper.cpp/tree/main).

**Provisional packaging:** SpeechAnalyzer uses system-managed language assets and adds no app Whisper model. If `whisper.rn` is approved as fallback, do not bundle `small.en`. Benchmark `tiny.en` and `base.en`; bundle `tiny.en` only if the total thinned TestFlight download remains comfortably below Apple’s 200 MB cellular warning and it meets the technical WER floor. Otherwise download `base.en` on first voice use with progress, retry, checksum verification, file-protection/backup exclusion, and Settings → Storage deletion. Never download a model without an explicit user action.

Session 4b must record thinned App Store size, installed size, model size, checksum, available-space preflight, interrupted-download recovery, and post-delete disk state. A “higher accuracy” model cannot be advertised until its measured gain is shown.

## 5. Vocabulary hints

Build hints from a fixed allowlist plus already-visible, non-secret names:

1. static developer vocabulary;
2. up to 20 recent repository/workspace display names;
3. up to 10 playbook titles;
4. up to 10 tag names.

Normalize, deduplicate case-insensitively, cap each item at 64 characters, cap the assembled string at 1,000 characters, and reject values matching the existing key/secret scrub patterns. Never read the Secrets list for hints. Tests must prove truncation, stable ordering, secret-shaped exclusion, and no transcript logging.

Benchmark every engine both without and with the identical semantic hint set. Report overall WER and technical-term miss count separately. A hint implementation is accepted only if it improves technical-term accuracy without materially degrading ordinary words.

**Measured SpeechAnalyzer result:** the 20-term allowlist produced 7 exact misses with hints off and the same 7 misses with hints on. All five hinted transcripts were identical to their unhinted counterparts. The second pass was faster because the language asset and audio were warm, not because recognition improved. Do not claim contextual strings improve DevinX vocabulary based on this evidence. Before Session 4b, either prove a benefit in the live-streaming path, add an explicit user-confirmed terminology correction layer, or select a Whisper candidate that wins the comparator.

## 6. Scribe decision

### Apple Foundation Models path

The framework is on-device and supports refinement plus guided generation into Swift structures, which maps well to Goal / Scope / Acceptance criteria / Constraints. [Apple Foundation Models](https://developer.apple.com/documentation/FoundationModels) It is not universal: Apple Intelligence requires iPhone 15 Pro or iPhone 16 and later, supported language/region, sufficient storage, Apple Intelligence enabled, and model availability. [Apple Intelligence requirements](https://support.apple.com/en-us/121115)

Before exposing it, Session 4b must check `SystemLanguageModel` availability and handle device-not-eligible, disabled, downloading, and unavailable states. Prompt behavior must be regression-tested across OS model updates; Apple explicitly advises retesting when the system model changes. [Foundation Models updates](https://developer.apple.com/documentation/Updates/FoundationModels)

### Deterministic fallback

This ships on every device and is the only guaranteed scribe tier:

- preserve the complete cleaned transcript;
- remove only a conservative filler allowlist when surrounded by speech boundaries;
- apply sentence casing and punctuation without changing technical tokens;
- populate the four section headings and place ambiguous content under Goal rather than inventing requirements;
- show before/after and require explicit confirmation.

**Decision:** Foundation Models is a progressive enhancement if the five-fixture scribe review passes; the deterministic template is always available. No network import exists in either implementation. Cloud LLM scribe remains Phase 2, opt-in, separately consented, and outside this build.

## 7. Expo, permission, and lifecycle implications

- EAS development/TestFlight build required; Expo Go is unsupported.
- Request microphone access only after the mic tap. No onboarding request and no speech-recognition permission if the selected engine needs only microphone access.
- Recording stops immediately when the app resigns active or an interruption begins; finalized and partial text already received remains in the composer.
- Route-change/unmount cancels capture and deletes temporary audio.
- Restore the prior audio session after stopping. Test built-in mic, wired/Bluetooth/AirPods route change, phone call, Siri, alarm, media playback, lock screen, and low storage.
- Mic, cancel, and stop have VoiceOver state labels and 44pt targets. Reduce Motion replaces animated waveform motion with static level bars.

## 8. Required physical benchmark

The fixtures, protocol, and dependency-free scorer live in `/spikes/voice/`. Build 37 supplied the natural-device result used for the v1 decision. Blank Whisper rows document deferred work and do not block SpeechAnalyzer v1; they become mandatory before any later build adds or switches to Whisper.

| Engine / exact model | Hints | Exact tech-term miss rate | Mean overall WER | Median file-analysis time | Median RTF | Peak memory | Device availability | Temp dir empty | Network silent |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| SpeechAnalyzer/SpeechTranscriber | off | 35.0% (7/20) | 9.01% | 0.946s | 0.0185 | 129.7 MiB | iPhone 16 Pro: yes; iPhone 13-class: pending | yes, success path | static gate only; runtime pending |
| SpeechAnalyzer/SpeechTranscriber | on | 35.0% (7/20) | 9.01% | 0.788s | 0.0153 | 128.8 MiB | iPhone 16 Pro: yes; iPhone 13-class: pending | yes, success path | static gate only; runtime pending |
| `whisper.rn` + `tiny.en` q5_1 | off/on | pending | pending | pending | pending | pending | pending | pending | pending |
| `whisper.rn` + `base.en` q5_1 | off/on | pending | pending | pending | pending | pending | pending | pending | pending |
| WhisperKit + selected comparable model | off/on | pending | pending | pending | pending | pending | pending | pending | pending |

### 8.1 Natural iPhone result — July 12, 2026

- Device: `Marky`, iPhone 16 Pro, iOS 26.5.2. App: private TestFlight 0.1.0 (37).
- Protocol: one natural read of each of the five fixtures, 51.1–54.2 seconds per fixture. Each local recording was analyzed once without and once with the identical 20-term vocabulary set, then deleted before the next fixture.
- Per-fixture overall WER was 8.77%, 5.08%, 12.61%, 7.27%, and 11.30%. Mean was 9.01%; median was 8.77%.
- Hints changed none of the five transcripts. Exact tracked-term misses were `OAuth`, `DevinX`, `TanStack Query`, `PostgreSQL`, `monorepo`, `TestFlight`, and `kebab-case` in both conditions: 7 misses out of 20 terms (35.0%). Several were spacing or segmentation variants (`Devin X`, `tan stack query`, `mono repo`, `test flight`, `kebab case`), while others were substantive substitutions (`OOF`, `postgress SQL`).
- Without hints, median post-recording file analysis was 0.946 seconds, median RTF was 0.0185, and maximum observed app resident memory was 129.7 MiB. With hints, the warm second pass was 0.788 seconds median, 0.0153 median RTF, and 128.8 MiB peak.
- Sharing results was enabled only after the native removal call returned success for every fixture, which confirms success-path deletion. The run did not capture runtime network traffic, exercise interruption/background failure deletion, measure live interim-result latency, or measure UI frame rate.
- Aggregate evidence is stored at `/spikes/voice/results/iphone-16-pro-speechanalyzer-2026-07-12.json`. Raw audio is intentionally absent and was deleted on-device.

**Interpretation:** SpeechAnalyzer comfortably clears the real-time and overall-WER performance bar on the tested device. The hint mechanism as exercised here has zero demonstrated value, and v1 must not advertise otherwise. Mark accepted the technical-term result as strong enough for the starting implementation on July 12, 2026. A future Whisper build should test quantized `base.en` against these same fixtures before claiming an accuracy or compatibility improvement.

### 8.2 Harness preflight completed July 12, 2026

This is smoke evidence only and does not replace the table above:

- Toolchain: macOS 26.5.1, Xcode 26.6, iPhoneOS SDK 26.5.
- The dependency-free SpeechAnalyzer harness compiles and runs on macOS, type-checks against the physical iPhoneOS target, builds as an iOS app, and is development-signed with Mark’s existing wildcard profile. It is isolated under `/spikes/voice/` and does not modify DevinX.
- The iPhone 17 simulator installs and launches the bundle but reports `SpeechTranscriber.isAvailable == false`; simulator performance/availability is therefore not usable as device evidence.
- The paired physical device discovered by Xcode is `Marky`, an iPhone 16 Pro on iOS 26.5.2. Direct installation was correctly rejected because Developer Mode is disabled; build 37 therefore used the production TestFlight path.
- On the Mac, all five synthetic `say` fixtures completed both with and without contextual strings. Overall WER by fixture was 6.78%, 11.40%, 11.71%, 13.64%, and 15.65% (median 11.71%). Hints produced identical transcripts in this synthetic smoke run. Median file-analysis time was 0.93 seconds, median file RTF was 0.0226, and maximum observed resident size was 21.5 MB.

These Mac values prove the harness and scoring pipeline, not mobile product quality. The natural-device result above supersedes them for SpeechAnalyzer product quality. Cross-engine comparison is deferred until a later build evaluates Whisper.

Acceptance floors:

- real-time factor ≤1.0 and streaming UI remains 60fps;
- zero audio network traffic and empty protected temp directory after every success, cancel, interruption, and failure;
- no memory termination across five consecutive 90-second runs;
- technical-term accuracy is reviewed explicitly; the v1 SpeechAnalyzer tradeoff was accepted on July 12, 2026 in exchange for no third-party runtime or app-managed model;
- no lost or duplicated words across interim/final result replacement.

## 9. Security review

Session 4b cannot merge without:

1. a static import test that fails on `fetch`, Axios, network clients, upload helpers, or API-client imports anywhere under `lib/voice/` and the native voice module;
2. a runtime network-capture test with airplane mode after model installation;
3. `NSFileProtectionComplete`, backup exclusion, random per-recording temp names, and finally-style deletion tested on success/error/cancel/background/termination;
4. no raw transcript, hint value, audio path, or error payload in logs/diagnostics/analytics;
5. explicit UI recording indicator and app-active guard before capture;
6. permission-denied recovery through Settings, without repeated prompts;
7. a dependency review repeated immediately before any selected package is pinned and committed.

## 10. Approval record

Decision recorded July 12, 2026:

- [x] **Transcription engine:** app-owned SpeechAnalyzer/SpeechTranscriber Expo module
- [x] **Fallback policy:** standard typing and a clear unavailable state; revisit Whisper in a later build
- [x] **Model packaging:** no app-managed speech model; use Apple’s system-managed locale asset
- [x] **Scribe:** deterministic template for all devices; Foundation Models only when available and after its quality check
- [x] **Measured limits accepted:** 9.01% mean WER, 0.946s median file analysis, 0.0185 median RTF, 129.7 MiB peak, and the documented technical-term tradeoff
- [ ] **Security evidence complete:** runtime network silence, deletion across every lifecycle path, and transcript scrubbing
- [x] **Session 4b authorized**

Session 4b may begin. It cannot merge or ship until the remaining security evidence is checked and the full §7.8 lifecycle/accessibility matrix passes.
