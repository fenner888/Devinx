# Session 4a — Voice Spec Analysis

**Date:** July 12, 2026  
**Status:** Analysis in progress; physical-device benchmark pending  
**Decision authority:** Mark Fenner  
**Build gate:** Session 4b is blocked until the benchmark table in §8 is completed and Mark approves §10.

## 1. Executive decision

Do not install a transcription dependency or begin Voice UI yet. The repository is ready for a native voice feature, but the decisive iPhone measurements have not been run and this record does not invent them.

The provisional architecture is:

- **Primary candidate:** a small DevinX-owned iOS Expo module around Apple `SpeechAnalyzer` + `SpeechTranscriber` on iOS 26 where `SpeechTranscriber.isAvailable` and the English model asset can be installed.
- **Fallback candidate:** `whisper.rn` with a quantized English model, only if the iPhone 13 benchmark shows that SpeechAnalyzer is unavailable or materially worse on developer vocabulary. It remains the broad-OS fallback under evaluation, not an approved dependency.
- **Do not select:** the current `expo-speech-recognition` wrapper as the new-API candidate. It explicitly implements legacy `SFSpeechRecognizer`, not SpeechAnalyzer.
- **Scribe:** Apple Foundation Models on eligible Apple Intelligence devices after a quality check, with the deterministic template implementation on every device. The template path is mandatory and cloud scribe remains out of v1.
- **Privacy:** audio stays on device. No voice implementation may import networking, retain recordings, log transcripts, or change the App Store “Data Not Collected” posture.

This recommendation overturns “install `whisper.rn` first” as the immediate default, but not yet as the measured fallback. Apple’s new engine removes a third-party native binary and Whisper model from most current devices, supplies live finalized results, supports contextual vocabulary, and uses system-managed language assets. Apple reports iOS 26 on 79% of active iPhones as of June 7, 2026, but availability must still be checked on the actual iPhone 13-class benchmark device. [Apple SpeechAnalyzer session](https://developer.apple.com/videos/play/wwdc2025/277/) · [Apple OS adoption](https://developer.apple.com/support/app-store/)

## 2. Repository baseline

- Expo SDK 54, React Native 0.81.5, TypeScript strict, New Architecture enabled.
- Native changes already ship through EAS/TestFlight. Expo Go cannot exercise the selected candidates.
- No microphone usage description exists yet. Session 4b must add exactly: “DevinX uses the microphone to transcribe your voice into session prompts. Audio is processed entirely on your device and never uploaded.”
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
- The physical benchmark is still missing.

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

## 8. Required physical benchmark (not yet run)

The fixtures, protocol, and dependency-free scorer live in `/spikes/voice/`. The following table is intentionally blank until a release build runs on the target device. Blank is a release gate, not a documentation defect.

| Engine / exact model | Hints | Tech-term WER | Overall WER | Median final latency | RTF | Peak memory | iPhone 13 available | Temp dir empty | Network silent |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| SpeechAnalyzer/SpeechTranscriber | off | pending | pending | pending | pending | pending | pending | pending | pending |
| SpeechAnalyzer/SpeechTranscriber | on | pending | pending | pending | pending | pending | pending | pending | pending |
| `whisper.rn` + `tiny.en` q5_1 | off/on | pending | pending | pending | pending | pending | pending | pending | pending |
| `whisper.rn` + `base.en` q5_1 | off/on | pending | pending | pending | pending | pending | pending | pending | pending |
| WhisperKit + selected comparable model | off/on | pending | pending | pending | pending | pending | pending | pending | pending |

Acceptance floors:

- real-time factor ≤1.0 and streaming UI remains 60fps;
- zero audio network traffic and empty protected temp directory after every success, cancel, interruption, and failure;
- no memory termination across five consecutive 90-second runs;
- technical-term WER no worse than 15% relative to the best candidate unless the storage/memory advantage is substantial and approved explicitly;
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

Mark must choose after §8 is filled:

- [ ] **Transcription engine:** SpeechAnalyzer local module / `whisper.rn` / WhisperKit
- [ ] **Fallback policy:** exact OS/hardware availability behavior
- [ ] **Model packaging:** none / bundled exact model / downloaded exact model
- [ ] **Scribe:** template only / Foundation Models plus template
- [ ] **Measured limits accepted:** WER, latency, RTF, peak memory, binary/download size
- [ ] **Security evidence reviewed:** network silence, temp deletion, transcript scrubbing
- [ ] **Session 4b authorized**

Until every selected line is checked, the approved deliverable is this analysis and the benchmark spike only.
