import AppKit
import Vision

guard CommandLine.arguments.count == 2 else { exit(2) }
let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let image = NSImage(contentsOf: imageURL),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    exit(3)
}

let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]
try VNImageRequestHandler(cgImage: cgImage).perform([request])
guard let payload = request.results?.compactMap(\.payloadStringValue).first,
      let data = payload.data(using: .utf8),
      let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
    exit(4)
}

let safeKeys = [
    "protocolVersion",
    "bridgeId",
    "bridgeKeyFingerprint",
    "transportSecurity",
    "bridgeEndpoint",
    "tlsCertificateFingerprint",
    "pairingId",
    "expiresAt",
]
let safe = safeKeys.reduce(into: [String: Any]()) { result, key in
    result[key] = object[key]
}
let output = try JSONSerialization.data(withJSONObject: safe, options: [.sortedKeys])
FileHandle.standardOutput.write(output)
FileHandle.standardOutput.write(Data("\n".utf8))
