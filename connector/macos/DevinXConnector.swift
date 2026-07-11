import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import ServiceManagement
import SwiftUI

private let ipcVersion = 1

private struct ConnectorDevice: Decodable, Identifiable {
    let deviceId: String
    let deviceName: String
    let pairedAt: Double
    let status: String
    let allowSessionContent: Bool
    let allowSessionPrompt: Bool
    let allowSessionCreate: Bool
    var id: String { deviceId }
}

private struct ConnectorEvent: Decodable {
    let version: Int
    let type: String
    let payload: String?
    let expiresAt: Double?
    let transport: String?
    let sessionDiscoveryEnabled: Bool?
    let cliDetected: Bool?
    let pairingId: String?
    let deviceName: String?
    let access: String?
    let code: String?
    let route: String?
    let phase: String?
    let status: Int?
    let devices: [ConnectorDevice]?
}

private enum ConnectorStatus: Equatable {
    case starting
    case ready
    case awaitingApproval
    case paired
    case failed(String)

    var label: String {
        switch self {
        case .starting: return "Starting securely…"
        case .ready: return "Ready to connect"
        case .awaitingApproval: return "Review this iPhone"
        case .paired: return "iPhone connected"
        case .failed: return "Needs attention"
        }
    }

    var symbol: String {
        switch self {
        case .starting: return "hourglass"
        case .ready: return "checkmark.circle.fill"
        case .awaitingApproval: return "iphone.and.arrow.forward"
        case .paired: return "checkmark.shield.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }
}

@MainActor
private final class ConnectorModel: ObservableObject {
    @Published var status: ConnectorStatus = .starting
    @Published var qrImage: NSImage?
    @Published var qrExpiresAt: Date?
    @Published var transportLabel = "Detecting private network…"
    @Published var cliDetected = false
    @Published var sessionDiscoveryEnabled = false
    @Published var pendingDeviceName: String?
    @Published var pendingPairingId: String?
    @Published var allowSessionContent = false
    @Published var launchAtLogin = false
    @Published var pairingDiagnostic: String?
    @Published var devices: [ConnectorDevice] = []

    private var process: Process?
    private var inputPipe: Pipe?
    private var outputBuffer = Data()
    private let maximumBufferedBytes = 65_536

    init() {
        refreshLaunchAtLogin()
        start()
    }

    func start() {
        guard process == nil else { return }
        status = .starting
        guard let resources = Bundle.main.resourceURL else {
            status = .failed("The connector resources are missing.")
            return
        }
        let nodeURL = resources.appendingPathComponent("runtime/node")
        let scriptURL = resources.appendingPathComponent("connector-runtime.cjs")

        let task = Process()
        let stdin = Pipe()
        let stdout = Pipe()
        let stderr = Pipe()
        task.executableURL = nodeURL
        task.arguments = [scriptURL.path]
        task.currentDirectoryURL = FileManager.default.homeDirectoryForCurrentUser
        var environment: [String: String] = [
            "HOME": FileManager.default.homeDirectoryForCurrentUser.path,
            "LANG": Locale.current.identifier,
            "NODE_ENV": "production",
            "NO_COLOR": "1",
            "PATH": connectorSearchPath(),
        ]
        if let user = ProcessInfo.processInfo.environment["USER"] { environment["USER"] = user }
        if let tmpdir = ProcessInfo.processInfo.environment["TMPDIR"] { environment["TMPDIR"] = tmpdir }
        task.environment = environment
        task.standardInput = stdin
        task.standardOutput = stdout
        task.standardError = stderr
        stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            Task { @MainActor in self?.consume(data) }
        }
        stderr.fileHandleForReading.readabilityHandler = { handle in
            _ = handle.availableData
        }
        task.terminationHandler = { [weak self] terminated in
            Task { @MainActor in
                guard let self else { return }
                guard self.process === terminated else { return }
                self.process = nil
                self.inputPipe = nil
                if case .failed = self.status { return }
                self.status = .failed(terminated.terminationStatus == 0
                    ? "The connector stopped."
                    : "The connector could not start securely.")
            }
        }
        do {
            try task.run()
            process = task
            inputPipe = stdin
        } catch {
            status = .failed("The connector runtime could not be opened.")
        }
    }

    func stop() {
        send(["version": ipcVersion, "type": "shutdown"])
        let activeProcess = process
        process = nil
        inputPipe = nil
        activeProcess?.terminate()
    }

    func regenerateCode() {
        pendingDeviceName = nil
        pendingPairingId = nil
        allowSessionContent = false
        send(["version": ipcVersion, "type": "regenerate"])
    }

    func approve() {
        guard let pairingId = pendingPairingId else { return }
        send([
            "version": ipcVersion,
            "type": "approve",
            "pairingId": pairingId,
            "allowSessionContent": allowSessionContent,
        ])
    }

    func deny() {
        guard let pairingId = pendingPairingId else { return }
        send(["version": ipcVersion, "type": "deny", "pairingId": pairingId])
        pendingDeviceName = nil
        pendingPairingId = nil
        allowSessionContent = false
    }

    func updateDevice(
        _ device: ConnectorDevice,
        content: Bool? = nil,
        prompt: Bool? = nil,
        create: Bool? = nil
    ) {
        send([
            "version": ipcVersion,
            "type": "update_device",
            "deviceId": device.deviceId,
            "allowSessionContent": content ?? device.allowSessionContent,
            "allowSessionPrompt": prompt ?? device.allowSessionPrompt,
            "allowSessionCreate": create ?? device.allowSessionCreate,
        ])
    }

    func revokeDevice(_ device: ConnectorDevice) {
        send(["version": ipcVersion, "type": "revoke_device", "deviceId": device.deviceId])
    }

    func setLaunchAtLogin(_ enabled: Bool) {
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
            refreshLaunchAtLogin()
        } catch {
            launchAtLogin = SMAppService.mainApp.status == .enabled
            status = .failed("Launch at login could not be updated.")
        }
    }

    private func refreshLaunchAtLogin() {
        launchAtLogin = SMAppService.mainApp.status == .enabled
    }

    private func connectorSearchPath() -> String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        return [
            "\(home)/.local/bin",
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
        ].joined(separator: ":")
    }

    private func consume(_ data: Data) {
        outputBuffer.append(data)
        if outputBuffer.count > maximumBufferedBytes {
            outputBuffer.removeAll(keepingCapacity: false)
            status = .failed("The connector returned an invalid response.")
            stop()
            return
        }
        while let newline = outputBuffer.firstIndex(of: 0x0A) {
            let line = outputBuffer.prefix(upTo: newline)
            outputBuffer.removeSubrange(...newline)
            guard !line.isEmpty else { continue }
            do {
                let event = try JSONDecoder().decode(ConnectorEvent.self, from: Data(line))
                guard event.version == ipcVersion else {
                    status = .failed("The connector needs to be updated.")
                    continue
                }
                handle(event)
            } catch {
                status = .failed("The connector returned an invalid response.")
            }
        }
    }

    private func handle(_ event: ConnectorEvent) {
        switch event.type {
        case "pairing_offer":
            guard let payload = event.payload, let image = makeQRCode(payload) else {
                status = .failed("The pairing code could not be rendered.")
                return
            }
            qrImage = image
            qrExpiresAt = event.expiresAt.map { Date(timeIntervalSince1970: $0 / 1_000) }
            if pendingPairingId == nil { status = .ready }
        case "ready":
            guard event.transport == "tailscale_vpn" else {
                status = .failed("This Connector version requires Tailscale.")
                return
            }
            transportLabel = "Tailscale connected"
            cliDetected = event.cliDetected ?? false
            sessionDiscoveryEnabled = event.sessionDiscoveryEnabled ?? false
            if pendingPairingId == nil { status = .ready }
        case "pairing_review":
            pendingPairingId = event.pairingId
            pendingDeviceName = event.deviceName
            status = .awaitingApproval
        case "pairing_diagnostic":
            guard let route = event.route,
                  let phase = event.phase,
                  let responseStatus = event.status else { return }
            let action = route == "protected_request"
                ? "Protected request"
                : route == "pairing_submit" ? "Pairing request" : "Approval check"
            pairingDiagnostic = "\(action) · \(phase) · HTTP \(responseStatus)"
        case "pairing_complete":
            pendingPairingId = nil
            pendingDeviceName = nil
            allowSessionContent = false
            status = .paired
        case "devices":
            devices = event.devices ?? []
        case "error":
            let message: String
            switch event.code {
            case "pairing_expired": message = "The pairing request expired. Generate a new code."
            case "command_invalid": message = "The connector received an invalid local command."
            case "tailscale_unavailable": message = "Connect this Mac to Tailscale, then try again."
            case "unsupported_platform": message = "This connector build does not support this Mac."
            default: message = "The secure connector could not complete that action."
            }
            status = .failed(message)
        default:
            status = .failed("The connector needs to be updated.")
        }
    }

    private func send(_ value: [String: Any]) {
        guard
            JSONSerialization.isValidJSONObject(value),
            let data = try? JSONSerialization.data(withJSONObject: value),
            data.count < 16_384,
            let pipe = inputPipe
        else { return }
        var line = data
        line.append(0x0A)
        do {
            try pipe.fileHandleForWriting.write(contentsOf: line)
        } catch {
            status = .failed("The connector stopped responding.")
        }
    }

    private func makeQRCode(_ payload: String) -> NSImage? {
        guard let data = payload.data(using: .utf8) else { return nil }
        let filter = CIFilter.qrCodeGenerator()
        filter.message = data
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 7, y: 7))
        let representation = NSCIImageRep(ciImage: scaled)
        let image = NSImage(size: representation.size)
        image.addRepresentation(representation)
        return image
    }
}

private struct StatusRow: View {
    let symbol: String
    let title: String
    let detail: String
    let available: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(available ? .green : .secondary)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

private struct ConnectorView: View {
    @ObservedObject var model: ConnectorModel

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                VStack(spacing: 8) {
                    Image(systemName: model.status.symbol)
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(statusColor)
                    Text("DevinX Connector")
                        .font(.system(size: 28, weight: .semibold))
                    Text(model.status.label)
                        .foregroundStyle(.secondary)
                }

                GroupBox {
                    VStack(spacing: 14) {
                        StatusRow(
                            symbol: "network",
                            title: "Tailscale",
                            detail: model.transportLabel,
                            available: model.status != .starting
                        )
                        Divider()
                        StatusRow(
                            symbol: "terminal",
                            title: "Devin for Terminal",
                            detail: model.cliDetected ? "Detected securely" : "Not detected — pairing only",
                            available: model.cliDetected
                        )
                    }
                    .padding(6)
                }

                if let deviceName = model.pendingDeviceName {
                    GroupBox("Pairing request") {
                        VStack(alignment: .leading, spacing: 14) {
                            Label(deviceName, systemImage: "iphone")
                                .font(.headline)
                            Text("Approve only if this is the iPhone in your hand.")
                                .font(.callout)
                                .foregroundStyle(.secondary)
                            Toggle("Allow session titles and message history", isOn: $model.allowSessionContent)
                            Text("Message steering is a separate permission added after read-only pairing is validated.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            HStack {
                                Button("Deny", role: .destructive) { model.deny() }
                                Spacer()
                                Button("Approve iPhone") { model.approve() }
                                    .buttonStyle(.borderedProminent)
                            }
                        }
                        .padding(6)
                    }
                } else if let qrImage = model.qrImage {
                    VStack(spacing: 12) {
                        Image(nsImage: qrImage)
                            .interpolation(.none)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 360, height: 360)
                            .accessibilityLabel("DevinX iPhone pairing QR code")
                        Text("On iPhone: DevinX → Settings → Computers → Add Mac")
                            .font(.callout)
                            .multilineTextAlignment(.center)
                        Text("The code expires automatically and is valid only for this computer.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                        Button("Generate new code") { model.regenerateCode() }
                    }
                }

                if let diagnostic = model.pairingDiagnostic {
                    Text(diagnostic)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }

                if !model.devices.isEmpty {
                    GroupBox("Paired iPhones") {
                        VStack(spacing: 0) {
                            ForEach(model.devices) { device in
                                VStack(alignment: .leading, spacing: 10) {
                                    HStack {
                                        Label(device.deviceName, systemImage: "iphone")
                                            .font(.headline)
                                        Spacer()
                                        if device.id == model.devices.last?.id {
                                            Text("Most recent")
                                                .font(.caption)
                                                .foregroundStyle(.blue)
                                        }
                                        Text(device.status == "active" ? "Active" : "Revoked")
                                            .font(.caption)
                                            .foregroundStyle(device.status == "active" ? .green : .secondary)
                                    }
                                    Text("Paired \(Date(timeIntervalSince1970: device.pairedAt / 1_000).formatted(date: .abbreviated, time: .shortened))")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Toggle("Read session titles and history", isOn: Binding(
                                        get: { device.allowSessionContent },
                                        set: { model.updateDevice(device, content: $0) }
                                    ))
                                    .disabled(device.status != "active")
                                    Toggle("Send messages to sessions", isOn: Binding(
                                        get: { device.allowSessionPrompt },
                                        set: { model.updateDevice(device, prompt: $0) }
                                    ))
                                    .disabled(device.status != "active")
                                    Toggle("Create new sessions", isOn: Binding(
                                        get: { device.allowSessionCreate },
                                        set: { model.updateDevice(device, create: $0) }
                                    ))
                                    .disabled(device.status != "active")
                                    if device.status == "active" {
                                        Button("Revoke iPhone", role: .destructive) {
                                            model.revokeDevice(device)
                                        }
                                    }
                                }
                                .padding(.vertical, 12)
                                if device.id != model.devices.last?.id { Divider() }
                            }
                        }
                        .padding(6)
                    }
                }

                if case let .failed(message) = model.status {
                    GroupBox {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(message).foregroundStyle(.red)
                            Button("Try again") { model.start() }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(6)
                    }
                }

                Toggle("Open DevinX Connector when I log in", isOn: Binding(
                    get: { model.launchAtLogin },
                    set: { model.setLaunchAtLogin($0) }
                ))
                .toggleStyle(.switch)

                Text("DevinX is an independent client and is not affiliated with Cognition AI.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(28)
        }
        .frame(minWidth: 520, minHeight: 700)
    }

    private var statusColor: Color {
        switch model.status {
        case .failed: return .red
        case .awaitingApproval: return .orange
        case .ready, .paired: return .green
        case .starting: return .secondary
        }
    }
}

@MainActor
private final class AppDelegate: NSObject, NSApplicationDelegate {
    private let model = ConnectorModel()
    private var window: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        showWindow()
    }

    func showWindow() {
        guard window == nil else {
            window?.makeKeyAndOrderFront(nil)
            return
        }
        let content = ConnectorView(model: model)
        let hostingController = NSHostingController(rootView: content)
        let window = NSWindow(contentViewController: hostingController)
        window.title = "DevinX Connector"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.styleMask.insert(.fullSizeContentView)
        window.setContentSize(NSSize(width: 560, height: 760))
        window.minSize = NSSize(width: 520, height: 700)
        window.center()
        window.makeKeyAndOrderFront(nil)
        self.window = window
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        model.stop()
    }
}

@main
private enum DevinXConnectorApplication {
    @MainActor
    static func main() {
        let application = NSApplication.shared
        application.setActivationPolicy(.regular)
        let delegate = AppDelegate()
        application.delegate = delegate
        application.finishLaunching()
        delegate.showWindow()
        application.run()
    }
}
