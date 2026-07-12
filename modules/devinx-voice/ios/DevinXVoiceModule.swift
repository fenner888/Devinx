import AVFAudio
import ExpoModulesCore
import Foundation
import FoundationModels
import Speech

public final class DevinXVoiceModule: Module {
  private var liveSession: AnyObject?
  private var interruptionObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("DevinXVoice")
    Events("onTranscriptionUpdate", "onVoiceLevel", "onVoiceState")

    AsyncFunction("availability") { () -> String in
      guard #available(iOS 26.0, *) else { return "unsupportedOS" }
      return SpeechTranscriber.isAvailable ? "available" : "unavailable"
    }

    AsyncFunction("prepare") { (hints: [String]) async throws in
      guard #available(iOS 26.0, *) else { throw VoiceError.unsupportedOS }
      try await Self.prepareSpeechAsset(hints: Self.validatedHints(hints))
    }

    AsyncFunction("start") { (hints: [String]) async throws in
      guard #available(iOS 26.0, *) else { throw VoiceError.unsupportedOS }
      guard self.liveSession == nil else { throw VoiceError.alreadyRecording }
      let session = try await LiveSpeechSession(
        hints: Self.validatedHints(hints),
        onTranscript: { [weak self] finalText, volatileText in
          self?.sendEvent("onTranscriptionUpdate", [
            "finalText": finalText,
            "volatileText": volatileText,
          ])
        },
        onLevel: { [weak self] level in
          self?.sendEvent("onVoiceLevel", ["level": level])
        }
      )
      self.liveSession = session
      do {
        try await session.start()
        self.sendEvent("onVoiceState", ["state": "recording"])
      } catch {
        self.liveSession = nil
        await session.cancel()
        throw error
      }
    }

    AsyncFunction("stop") { () async throws -> String in
      guard #available(iOS 26.0, *) else { throw VoiceError.unsupportedOS }
      guard let session = self.liveSession as? LiveSpeechSession else {
        throw VoiceError.notRecording
      }
      self.liveSession = nil
      let transcript = try await session.stop()
      self.sendEvent("onVoiceState", ["state": "stopped"])
      return transcript
    }

    AsyncFunction("cancel") { () async in
      await self.cancelActiveSession(state: "cancelled", reason: nil)
    }

    AsyncFunction("scribeAvailability") { () -> String in
      guard #available(iOS 26.0, *) else { return "unsupportedOS" }
      switch SystemLanguageModel.default.availability {
      case .available:
        return "available"
      case .unavailable(.deviceNotEligible):
        return "deviceNotEligible"
      case .unavailable(.appleIntelligenceNotEnabled):
        return "appleIntelligenceNotEnabled"
      case .unavailable(.modelNotReady):
        return "modelNotReady"
      @unknown default:
        return "modelNotReady"
      }
    }

    AsyncFunction("structureTranscript") {
      (transcript: String, context: String) async throws -> String in
      guard #available(iOS 26.0, *) else { throw VoiceError.unsupportedOS }
      let cleanTranscript = try Self.validatedText(transcript, maximumLength: 100_000)
      let cleanContext = try Self.validatedText(context, maximumLength: 2_000, allowEmpty: true)
      guard SystemLanguageModel.default.isAvailable else { throw VoiceError.scribeUnavailable }

      let instructions = """
      Transform a dictated software-work transcript into an accurate Devin work order.
      Preserve every concrete requirement, proper noun, technical token, number, and non-goal.
      Do not invent requirements, repositories, deadlines, credentials, or acceptance criteria.
      Return editable plain text with exactly these headings: Goal, Scope / repo,
      Acceptance criteria, Constraints / non-goals. Use hyphen bullets where useful.
      """
      let prompt = """
      Known non-secret context:
      \(cleanContext.isEmpty ? "Not provided" : cleanContext)

      Dictated transcript:
      \(cleanTranscript)
      """
      let session = LanguageModelSession(instructions: instructions)
      let response = try await session.respond(to: prompt)
      return try Self.validatedText(response.content, maximumLength: 120_000)
    }

    OnCreate {
      self.interruptionObserver = NotificationCenter.default.addObserver(
        forName: AVAudioSession.interruptionNotification,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              AVAudioSession.InterruptionType(rawValue: rawType) == .began else { return }
        Task { await self?.cancelActiveSession(state: "interrupted", reason: "audioInterruption") }
      }
    }

    OnAppEntersBackground {
      Task { await self.cancelActiveSession(state: "interrupted", reason: "background") }
    }

    OnDestroy {
      if let observer = self.interruptionObserver {
        NotificationCenter.default.removeObserver(observer)
        self.interruptionObserver = nil
      }
      Task { await self.cancelActiveSession(state: "cancelled", reason: "moduleDestroyed") }
    }
  }

  private func cancelActiveSession(state: String, reason: String?) async {
    guard #available(iOS 26.0, *), let session = liveSession as? LiveSpeechSession else { return }
    liveSession = nil
    await session.cancel()
    var body: [String: Any?] = ["state": state]
    body["reason"] = reason
    sendEvent("onVoiceState", body)
  }

  @available(iOS 26.0, *)
  private static func prepareSpeechAsset(hints: [String]) async throws {
    guard SpeechTranscriber.isAvailable else { throw VoiceError.speechUnavailable }
    let requestedLocale = Locale(identifier: "en-US")
    guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: requestedLocale) else {
      throw VoiceError.localeUnavailable
    }
    let transcriber = SpeechTranscriber(locale: locale, preset: .progressiveTranscription)
    let modules: [any SpeechModule] = [transcriber]
    if await AssetInventory.status(forModules: modules) != .installed,
       let request = try await AssetInventory.assetInstallationRequest(supporting: modules) {
      try await request.downloadAndInstall()
    }
    guard await AssetInventory.status(forModules: modules) == .installed else {
      throw VoiceError.assetUnavailable
    }
    _ = hints
  }

  private static func validatedHints(_ hints: [String]) throws -> [String] {
    guard hints.count <= 64 else { throw VoiceError.invalidInput }
    var result: [String] = []
    var seen = Set<String>()
    var totalLength = 0
    for rawHint in hints {
      let hint = rawHint.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !hint.isEmpty, hint.count <= 64, hint.rangeOfCharacter(from: .newlines) == nil else {
        throw VoiceError.invalidInput
      }
      let key = hint.lowercased()
      guard !seen.contains(key) else { continue }
      totalLength += hint.count
      guard totalLength <= 1_000 else { break }
      seen.insert(key)
      result.append(hint)
    }
    return result
  }

  private static func validatedText(
    _ text: String,
    maximumLength: Int,
    allowEmpty: Bool = false
  ) throws -> String {
    let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard (allowEmpty || !value.isEmpty), value.count <= maximumLength else {
      throw VoiceError.invalidInput
    }
    return value
  }
}

@available(iOS 26.0, *)
@MainActor
private final class LiveSpeechSession: NSObject {
  private let engine = AVAudioEngine()
  private let analyzer: SpeechAnalyzer
  private let transcriber: SpeechTranscriber
  private let onTranscript: (String, String) -> Void
  private let onLevel: (Double) -> Void
  private let previousCategory: AVAudioSession.Category
  private let previousMode: AVAudioSession.Mode
  private let previousOptions: AVAudioSession.CategoryOptions
  private var inputContinuation: AsyncStream<AnalyzerInput>.Continuation?
  private var analysisTask: Task<Void, Error>?
  private var resultTask: Task<String, Error>?
  private var finalText = ""
  private var stopped = false
  private var tapInstalled = false
  private var engineStarted = false

  init(
    hints: [String],
    onTranscript: @escaping (String, String) -> Void,
    onLevel: @escaping (Double) -> Void
  ) async throws {
    let requestedLocale = Locale(identifier: "en-US")
    guard SpeechTranscriber.isAvailable,
          let locale = await SpeechTranscriber.supportedLocale(equivalentTo: requestedLocale) else {
      throw VoiceError.speechUnavailable
    }
    let transcriber = SpeechTranscriber(locale: locale, preset: .progressiveTranscription)
    let modules: [any SpeechModule] = [transcriber]
    if await AssetInventory.status(forModules: modules) != .installed,
       let request = try await AssetInventory.assetInstallationRequest(supporting: modules) {
      try await request.downloadAndInstall()
    }
    guard await AssetInventory.status(forModules: modules) == .installed else {
      throw VoiceError.assetUnavailable
    }
    let context = AnalysisContext()
    if !hints.isEmpty { context.contextualStrings[.general] = hints }
    self.transcriber = transcriber
    self.analyzer = SpeechAnalyzer(modules: modules)
    self.onTranscript = onTranscript
    self.onLevel = onLevel
    let audioSession = AVAudioSession.sharedInstance()
    self.previousCategory = audioSession.category
    self.previousMode = audioSession.mode
    self.previousOptions = audioSession.categoryOptions
    super.init()
    try await analyzer.setContext(context)
  }

  func start() async throws {
    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.record, mode: .measurement, options: [.allowBluetoothHFP])
    try audioSession.setActive(true)

    let inputNode = engine.inputNode
    let naturalFormat = inputNode.outputFormat(forBus: 0)
    guard naturalFormat.sampleRate > 0,
          let analysisFormat = await SpeechAnalyzer.bestAvailableAudioFormat(
            compatibleWith: [transcriber],
            considering: naturalFormat
          ) else {
      throw VoiceError.audioUnavailable
    }
    try await analyzer.prepareToAnalyze(in: analysisFormat)

    var continuation: AsyncStream<AnalyzerInput>.Continuation?
    let inputStream = AsyncStream<AnalyzerInput> { continuation = $0 }
    guard let inputContinuation = continuation else { throw VoiceError.audioUnavailable }
    self.inputContinuation = inputContinuation

    resultTask = Task { [weak self, transcriber] in
      var completed = ""
      for try await result in transcriber.results {
        guard let self, !Task.isCancelled else { break }
        let text = String(result.text.characters).trimmingCharacters(in: .whitespacesAndNewlines)
        if result.isFinal {
          if !text.isEmpty { completed = Self.join(completed, text) }
          self.finalText = completed
          self.onTranscript(completed, "")
        } else {
          self.onTranscript(completed, text)
        }
      }
      return completed
    }
    analysisTask = Task { [analyzer] in
      try await analyzer.start(inputSequence: inputStream)
    }

    inputNode.installTap(onBus: 0, bufferSize: 1_024, format: analysisFormat) {
      [onLevel] buffer, _ in
      inputContinuation.yield(AnalyzerInput(buffer: buffer))
      onLevel(Self.normalizedLevel(buffer))
    }
    tapInstalled = true
    engine.prepare()
    try engine.start()
    engineStarted = true
  }

  func stop() async throws -> String {
    guard !stopped else { return finalText }
    stopped = true
    if tapInstalled {
      engine.inputNode.removeTap(onBus: 0)
      tapInstalled = false
    }
    if engineStarted {
      engine.stop()
      engineStarted = false
    }
    inputContinuation?.finish()
    inputContinuation = nil
    do {
      try await analyzer.finalizeAndFinishThroughEndOfInput()
      try await analysisTask?.value
      let transcript = try await resultTask?.value ?? finalText
      await restoreAudioSession()
      return transcript
    } catch {
      await restoreAudioSession()
      throw error
    }
  }

  func cancel() async {
    guard !stopped else { return }
    stopped = true
    if tapInstalled {
      engine.inputNode.removeTap(onBus: 0)
      tapInstalled = false
    }
    if engineStarted {
      engine.stop()
      engineStarted = false
    }
    inputContinuation?.finish()
    inputContinuation = nil
    await analyzer.cancelAndFinishNow()
    analysisTask?.cancel()
    resultTask?.cancel()
    await restoreAudioSession()
  }

  private func restoreAudioSession() async {
    let audioSession = AVAudioSession.sharedInstance()
    try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
    try? audioSession.setCategory(previousCategory, mode: previousMode, options: previousOptions)
  }

  private static func join(_ prefix: String, _ suffix: String) -> String {
    prefix.isEmpty ? suffix : "\(prefix) \(suffix)"
  }

  private nonisolated static func normalizedLevel(_ buffer: AVAudioPCMBuffer) -> Double {
    guard let data = buffer.floatChannelData?[0] else { return 0 }
    let frameCount = Int(buffer.frameLength)
    guard frameCount > 0 else { return 0 }
    var sum = 0.0
    for index in 0..<frameCount {
      let sample = Double(data[index])
      sum += sample * sample
    }
    let rms = sqrt(sum / Double(frameCount))
    return min(1, max(0, (20 * log10(max(rms, 0.000_001)) + 60) / 60))
  }
}

private enum VoiceError: CodedError {
  case unsupportedOS
  case speechUnavailable
  case localeUnavailable
  case assetUnavailable
  case audioUnavailable
  case alreadyRecording
  case notRecording
  case scribeUnavailable
  case invalidInput

  var code: String {
    switch self {
    case .unsupportedOS: return "ERR_VOICE_UNSUPPORTED_OS"
    case .speechUnavailable: return "ERR_VOICE_SPEECH_UNAVAILABLE"
    case .localeUnavailable: return "ERR_VOICE_LOCALE_UNAVAILABLE"
    case .assetUnavailable: return "ERR_VOICE_ASSET_UNAVAILABLE"
    case .audioUnavailable: return "ERR_VOICE_AUDIO_UNAVAILABLE"
    case .alreadyRecording: return "ERR_VOICE_ALREADY_RECORDING"
    case .notRecording: return "ERR_VOICE_NOT_RECORDING"
    case .scribeUnavailable: return "ERR_VOICE_SCRIBE_UNAVAILABLE"
    case .invalidInput: return "ERR_VOICE_INVALID_INPUT"
    }
  }

  var description: String {
    switch self {
    case .unsupportedOS: return "On-device voice requires iOS 26 or later"
    case .speechUnavailable: return "On-device transcription is unavailable"
    case .localeUnavailable: return "The English transcription locale is unavailable"
    case .assetUnavailable: return "The on-device transcription asset is unavailable"
    case .audioUnavailable: return "The microphone audio stream is unavailable"
    case .alreadyRecording: return "Voice recording is already active"
    case .notRecording: return "Voice recording is not active"
    case .scribeUnavailable: return "On-device scribe is unavailable"
    case .invalidInput: return "Voice input is invalid"
    }
  }
}
