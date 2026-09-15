import AppKit
import Vision

@main
struct ConnectorPairingCodeHarness {
    static func main() throws {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var lifetime = ConnectorPairingCodeLifetime()
        precondition(!lifetime.consumeExpiry(now: now))
        lifetime.receive(expiresAt: now.addingTimeInterval(120))
        precondition(!lifetime.consumeExpiry(now: now.addingTimeInterval(119)))
        precondition(lifetime.consumeExpiry(now: now.addingTimeInterval(120)))
        precondition(!lifetime.consumeExpiry(now: now.addingTimeInterval(121)))
        lifetime.receive(expiresAt: now.addingTimeInterval(240))
        lifetime.clear() // stop/termination must invalidate previous expiry
        precondition(!lifetime.consumeExpiry(now: now.addingTimeInterval(250)))
        lifetime.receive(expiresAt: now.addingTimeInterval(360)) // restart
        precondition(lifetime.consumeExpiry(now: now.addingTimeInterval(360)))

        let payload = "{\"protocolVersion\":2,\"fixture\":\"" + String(repeating: "0123456789ABCDEF", count: 55) + "\"}"
        guard let image = ConnectorPairingCode.render(payload),
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            fatalError("QR rendering failed")
        }
        for background in [NSColor.white, NSColor.black] {
            let canvas = NSImage(size: NSSize(width: 400, height: 400))
            canvas.lockFocus()
            background.setFill()
            NSRect(x: 0, y: 0, width: 400, height: 400).fill()
            NSGraphicsContext.current?.imageInterpolation = .none
            image.draw(in: NSRect(x: 20, y: 20, width: 360, height: 360))
            canvas.unlockFocus()
            guard let rendered = canvas.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fatalError("Canvas failed") }
            let request = VNDetectBarcodesRequest()
            request.symbologies = [.qr]
            try VNImageRequestHandler(cgImage: rendered).perform([request])
            precondition(request.results?.first?.payloadStringValue == payload, "QR must decode at displayed size")
        }
        precondition(cgImage.width > 0)
        precondition(ConnectorPairingCode.render(String(repeating: "x", count: 4_097)) == nil)
        print("PASS expiry refresh-once stop restart QR light dark 360px")
    }
}
