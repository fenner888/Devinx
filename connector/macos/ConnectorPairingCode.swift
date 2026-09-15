import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins

// No payload or secret is retained in this expiry policy.
struct ConnectorPairingCodeLifetime {
    private(set) var expiresAt: Date?

    mutating func receive(expiresAt: Date) { self.expiresAt = expiresAt }
    mutating func clear() { expiresAt = nil }

    mutating func consumeExpiry(now: Date) -> Bool {
        guard let expiresAt, now >= expiresAt else { return false }
        clear()
        return true
    }
}

enum ConnectorPairingCode {
    static func render(_ payload: String) -> NSImage? {
        guard let data = payload.data(using: .utf8), data.count <= 4_096 else { return nil }
        let filter = CIFilter.qrCodeGenerator()
        filter.message = data
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        // Four white modules are required around the QR, independent of dark mode.
        let extent = output.extent.insetBy(dx: -4, dy: -4)
        let white = CIImage(color: .white).cropped(to: extent)
        let padded = output.composited(over: white)
            .transformed(by: CGAffineTransform(scaleX: 7, y: 7))
        guard let bitmap = CIContext().createCGImage(padded, from: padded.extent) else { return nil }
        return NSImage(cgImage: bitmap, size: NSSize(width: bitmap.width, height: bitmap.height))
    }
}
