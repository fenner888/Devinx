import AppKit
import Vision

guard CommandLine.arguments.count == 2 else { exit(2) }
let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let image = NSImage(contentsOf: imageURL),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    exit(3)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
try VNImageRequestHandler(cgImage: cgImage).perform([request])
let lines = request.results?.compactMap { $0.topCandidates(1).first?.string } ?? []
let diagnostics = lines.filter { line in
    let value = line.lowercased()
    return value.contains("pairing request") ||
        value.contains("approval check") ||
        value.contains("http 20") ||
        value.contains("http 40") ||
        value.contains("http 41") ||
        value.contains("http 42") ||
        value.contains("http 50")
}
for line in diagnostics {
    print(line)
}
