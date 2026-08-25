import Foundation

/// Owns every resource associated with one Connector runtime child process.
///
/// `FileHandle.readabilityHandler` remains scheduled after `availableData`
/// returns empty unless the handler is explicitly removed. Keeping the process
/// and all pipes in one run context makes every exit path perform the same
/// idempotent cleanup before another child can start.
final class ConnectorProcessSupervisor: @unchecked Sendable {
    private enum OutputStream { case stdout, stderr }

    private final class RunContext: @unchecked Sendable {
        let process: Process
        let input: Pipe
        let output: Pipe
        let error: Pipe
        var outputEOF = false
        var errorEOF = false
        var cleaned = false

        init(process: Process, input: Pipe, output: Pipe, error: Pipe) {
            self.process = process
            self.input = input
            self.output = output
            self.error = error
        }
    }

    struct Snapshot: Equatable {
        let active: Bool
        let running: Bool
        let outputHandlerInstalled: Bool
        let errorHandlerInstalled: Bool
    }

    var onOutput: (@Sendable (Data) -> Void)?
    var onError: (@Sendable (Data) -> Void)?
    var onTermination: (@Sendable (Int32) -> Void)?

    private let lock = NSLock()
    private var activeRun: RunContext?

    var isActive: Bool { lock.withLock { activeRun != nil } }
    var isRunning: Bool { lock.withLock { activeRun?.process.isRunning == true } }

    func snapshot() -> Snapshot {
        lock.withLock {
            Snapshot(
                active: activeRun != nil,
                running: activeRun?.process.isRunning == true,
                outputHandlerInstalled: activeRun?.output.fileHandleForReading.readabilityHandler != nil,
                errorHandlerInstalled: activeRun?.error.fileHandleForReading.readabilityHandler != nil
            )
        }
    }

    func start(
        executableURL: URL,
        arguments: [String],
        currentDirectoryURL: URL,
        environment: [String: String]
    ) throws {
        let context = RunContext(
            process: Process(), input: Pipe(), output: Pipe(), error: Pipe()
        )
        context.process.executableURL = executableURL
        context.process.arguments = arguments
        context.process.currentDirectoryURL = currentDirectoryURL
        context.process.environment = environment
        context.process.standardInput = context.input
        context.process.standardOutput = context.output
        context.process.standardError = context.error

        context.output.fileHandleForReading.readabilityHandler = { [weak self, weak context] handle in
            guard let self, let context else { return }
            let data = handle.availableData
            if data.isEmpty {
                self.handleEOF(context, stream: .stdout)
            } else {
                self.onOutput?(data)
            }
        }
        context.error.fileHandleForReading.readabilityHandler = { [weak self, weak context] handle in
            guard let self, let context else { return }
            let data = handle.availableData
            if data.isEmpty {
                self.handleEOF(context, stream: .stderr)
            } else {
                self.onError?(data)
            }
        }
        context.process.terminationHandler = { [weak self, weak context] process in
            guard let self, let context else { return }
            self.finish(context, status: process.terminationStatus, notify: true)
        }

        let accepted = lock.withLock { () -> Bool in
            guard activeRun == nil else { return false }
            activeRun = context
            return true
        }
        guard accepted else { throw SupervisorError.alreadyRunning }

        do {
            try context.process.run()
            // The child owns the opposite endpoints after launch. Closing the
            // parent's unused copies guarantees real EOF delivery.
            close(context.input.fileHandleForReading)
            close(context.output.fileHandleForWriting)
            close(context.error.fileHandleForWriting)
        } catch {
            finish(context, status: nil, notify: false)
            throw error
        }
    }

    @discardableResult
    func write(_ data: Data) -> Bool {
        let handle = lock.withLock { activeRun?.input.fileHandleForWriting }
        guard let handle else { return false }
        do {
            try handle.write(contentsOf: data)
            return true
        } catch {
            return false
        }
    }

    func stop() {
        let context = lock.withLock { activeRun }
        guard let context else { return }
        finish(context, status: nil, notify: false)
        if context.process.isRunning { context.process.terminate() }
    }

    private func handleEOF(_ context: RunContext, stream: OutputStream) {
        let handle: FileHandle? = lock.withLock {
            guard activeRun === context, !context.cleaned else { return nil }
            switch stream {
            case .stdout:
                guard !context.outputEOF else { return nil }
                context.outputEOF = true
                context.output.fileHandleForReading.readabilityHandler = nil
                return context.output.fileHandleForReading
            case .stderr:
                guard !context.errorEOF else { return nil }
                context.errorEOF = true
                context.error.fileHandleForReading.readabilityHandler = nil
                return context.error.fileHandleForReading
            }
        }
        if let handle { close(handle) }
    }

    private func finish(_ context: RunContext, status: Int32?, notify: Bool) {
        let shouldNotify = lock.withLock { () -> Bool in
            guard !context.cleaned else { return false }
            context.cleaned = true
            context.process.terminationHandler = nil
            context.output.fileHandleForReading.readabilityHandler = nil
            context.error.fileHandleForReading.readabilityHandler = nil
            if activeRun === context { activeRun = nil }
            return notify && status != nil
        }

        close(context.input.fileHandleForReading)
        close(context.input.fileHandleForWriting)
        close(context.output.fileHandleForReading)
        close(context.output.fileHandleForWriting)
        close(context.error.fileHandleForReading)
        close(context.error.fileHandleForWriting)
        if shouldNotify, let status { onTermination?(status) }
    }

    private func close(_ handle: FileHandle) { try? handle.close() }

    enum SupervisorError: Error { case alreadyRunning }
}

private extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try body()
    }
}
