import AVFAudio
import Foundation
import Speech

struct Output: Codable {
  let engine: String
  let locale: String
  let available: Bool
  let assetStatus: String
  let hintsEnabled: Bool
  let audioSeconds: Double
  let elapsedSeconds: Double
  let realTimeFactor: Double
  let finalResultCount: Int
  let transcript: String
}

enum BenchmarkError: Error, CustomStringConvertible {
  case usage
  case unavailable
  case unsupportedLocale

  var description: String {
    switch self {
    case .usage:
      return "Usage: SpeechAnalyzerBenchmark <audio-file> [--hints-file <text-file>]"
    case .unavailable:
      return "SpeechTranscriber is unavailable on this device"
    case .unsupportedLocale:
      return "English (United States) is not supported by SpeechTranscriber"
    }
  }
}

@main
struct SpeechAnalyzerBenchmark {
  static func main() async {
    do {
      try await run()
    } catch {
      FileHandle.standardError.write(Data("\(error)\n".utf8))
      Foundation.exit(1)
    }
  }

  static func run() async throws {
    let arguments = Array(CommandLine.arguments.dropFirst())
    guard let requestedAudioPath = arguments.first else { throw BenchmarkError.usage }
    let hintsPath: String? = {
      guard let index = arguments.firstIndex(of: "--hints-file"), arguments.indices.contains(index + 1) else {
        return nil
      }
      return arguments[index + 1]
    }()

    guard SpeechTranscriber.isAvailable else { throw BenchmarkError.unavailable }
    let requestedLocale = Locale(identifier: "en-US")
    guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: requestedLocale) else {
      throw BenchmarkError.unsupportedLocale
    }

    let transcriber = SpeechTranscriber(locale: locale, preset: .transcription)
    let modules: [any SpeechModule] = [transcriber]
    var status = await AssetInventory.status(forModules: modules)
    if status != .installed {
      if let request = try await AssetInventory.assetInstallationRequest(supporting: modules) {
        try await request.downloadAndInstall()
      }
      status = await AssetInventory.status(forModules: modules)
    }

    let context = AnalysisContext()
    if let hintsPath {
      let directHintsURL = URL(fileURLWithPath: hintsPath)
      let hintsURL: URL
      if FileManager.default.fileExists(atPath: directHintsURL.path) {
        hintsURL = directHintsURL
      } else if let bundled = Bundle.main.url(
        forResource: (hintsPath as NSString).deletingPathExtension,
        withExtension: (hintsPath as NSString).pathExtension
      ) {
        hintsURL = bundled
      } else {
        throw CocoaError(.fileNoSuchFile)
      }
      let hints = try String(contentsOf: hintsURL, encoding: .utf8)
        .split(whereSeparator: \.isNewline)
        .map(String.init)
        .filter { !$0.isEmpty }
      context.contextualStrings[.general] = hints
    }

    let directAudioURL = URL(fileURLWithPath: requestedAudioPath)
    let audioURL: URL
    if FileManager.default.fileExists(atPath: directAudioURL.path) {
      audioURL = directAudioURL
    } else if let bundled = Bundle.main.url(
      forResource: (requestedAudioPath as NSString).deletingPathExtension,
      withExtension: (requestedAudioPath as NSString).pathExtension
    ) {
      audioURL = bundled
    } else {
      throw CocoaError(.fileNoSuchFile)
    }
    let audioFile = try AVAudioFile(forReading: audioURL)
    let audioSeconds = Double(audioFile.length) / audioFile.fileFormat.sampleRate
    let analyzer = SpeechAnalyzer(modules: modules)
    try await analyzer.setContext(context)

    let resultTask = Task { () throws -> (String, Int) in
      var finalized: [String] = []
      for try await result in transcriber.results {
        if result.isFinal {
          finalized.append(String(result.text.characters))
        }
      }
      return (finalized.joined(separator: " "), finalized.count)
    }

    let started = ContinuousClock.now
    try await analyzer.start(inputAudioFile: audioFile, finishAfterFile: true)
    let (transcript, finalCount) = try await resultTask.value
    let elapsed = started.duration(to: .now)
    let elapsedSeconds = Double(elapsed.components.seconds)
      + Double(elapsed.components.attoseconds) / 1_000_000_000_000_000_000

    let output = Output(
      engine: "SpeechAnalyzer/SpeechTranscriber",
      locale: locale.identifier,
      available: true,
      assetStatus: String(describing: status),
      hintsEnabled: hintsPath != nil,
      audioSeconds: audioSeconds,
      elapsedSeconds: elapsedSeconds,
      realTimeFactor: audioSeconds > 0 ? elapsedSeconds / audioSeconds : 0,
      finalResultCount: finalCount,
      transcript: transcript
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let outputData = try encoder.encode(output)
    if Bundle.main.bundleIdentifier == "com.fenner888.voicebenchmark",
       let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
      try? FileManager.default.createDirectory(at: documents, withIntermediateDirectories: true)
      let mode = hintsPath == nil ? "off" : "on"
      let name = "\(audioURL.deletingPathExtension().lastPathComponent)-hints-\(mode).json"
      try outputData.write(to: documents.appendingPathComponent(name), options: .atomic)
    }
    FileHandle.standardOutput.write(outputData)
    FileHandle.standardOutput.write(Data("\n".utf8))
  }
}
