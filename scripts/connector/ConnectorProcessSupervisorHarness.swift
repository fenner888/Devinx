import Darwin
import Foundation

private final class LockedCounters: @unchecked Sendable {
    private let lock = NSLock()
    private var outputBytes = 0
    private var errorBytes = 0
    private var terminations: [Int32] = []

    func addOutput(_ data: Data) { lock.withLock { outputBytes += data.count } }
    func addError(_ data: Data) { lock.withLock { errorBytes += data.count } }
    func addTermination(_ status: Int32) { lock.withLock { terminations.append(status) } }
    func snapshot() -> (Int, Int, [Int32]) {
        lock.withLock { (outputBytes, errorBytes, terminations) }
    }
}

private enum HarnessFailure: Error, CustomStringConvertible {
    case assertion(String)

    var description: String {
        switch self { case let .assertion(message): return message }
    }
}

private func require(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    guard condition() else { throw HarnessFailure.assertion(message) }
}

private func waitUntil(
    timeout: TimeInterval = 5,
    intervalMicroseconds: useconds_t = 10_000,
    _ condition: () -> Bool
) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
        if condition() { return true }
        usleep(intervalMicroseconds)
    }
    return condition()
}

private func cpuSeconds() -> Double {
    Double(clock()) / Double(CLOCKS_PER_SEC)
}

private func maximumResidentBytes() -> Int64 {
    var usage = rusage()
    guard getrusage(RUSAGE_SELF, &usage) == 0 else { return 0 }
    return Int64(usage.ru_maxrss)
}

private func directoryBytes(_ url: URL) -> Int64 {
    guard let enumerator = FileManager.default.enumerator(
        at: url,
        includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey]
    ) else { return 0 }
    var total: Int64 = 0
    for case let fileURL as URL in enumerator {
        guard let values = try? fileURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
              values.isRegularFile == true else { continue }
        total += Int64(values.fileSize ?? 0)
    }
    return total
}

private func startShell(
    _ supervisor: ConnectorProcessSupervisor,
    command: String,
    home: URL
) throws {
    try supervisor.start(
        executableURL: URL(fileURLWithPath: "/bin/sh"),
        arguments: ["-c", command],
        currentDirectoryURL: home,
        environment: [
            "HOME": home.path,
            "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
            "LANG": "en_US.UTF-8",
        ]
    )
}

@main
private enum ConnectorProcessSupervisorHarness {
    static func main() throws {
        let home = FileManager.default.temporaryDirectory
            .appendingPathComponent("devinx-supervisor-harness-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: home) }

        let supervisor = ConnectorProcessSupervisor()
        let counters = LockedCounters()
        supervisor.onOutput = { counters.addOutput($0) }
        supervisor.onError = { counters.addError($0) }
        supervisor.onTermination = { counters.addTermination($0) }

        // A normal child exit must deliver both streams, remove both handlers,
        // close every pipe, and leave no callbacks spinning at EOF.
        try startShell(supervisor, command: "printf stdout; printf stderr >&2", home: home)
        try require(waitUntil { !supervisor.isActive }, "normal child exit did not clean the active run")
        try require(waitUntil {
            let value = counters.snapshot()
            return value.0 >= 6 && value.1 >= 6
        }, "stdout or stderr was not drained before cleanup")
        let afterExit = supervisor.snapshot()
        try require(!afterExit.active && !afterExit.running, "child exit left a runtime active")
        try require(!afterExit.outputHandlerInstalled, "stdout handler survived child exit")
        try require(!afterExit.errorHandlerInstalled, "stderr handler survived child exit")

        let callbackCountsAtIdle = counters.snapshot()
        let idleCPUStart = cpuSeconds()
        usleep(800_000)
        let idleCPU = cpuSeconds() - idleCPUStart
        let callbackCountsAfterIdle = counters.snapshot()
        try require(callbackCountsAtIdle == callbackCountsAfterIdle, "callbacks continued firing after EOF")
        try require(idleCPU < 0.15, "idle CPU gate failed after EOF: \(idleCPU) seconds")

        // A Process.run launch failure must clean the pre-installed handlers,
        // and a valid child must still be restartable immediately afterward.
        do {
            try supervisor.start(
                executableURL: home.appendingPathComponent("missing-runtime"),
                arguments: [],
                currentDirectoryURL: home,
                environment: ["HOME": home.path]
            )
            throw HarnessFailure.assertion("missing executable unexpectedly launched")
        } catch HarnessFailure.assertion {
            throw HarnessFailure.assertion("missing executable unexpectedly launched")
        } catch {
            // Expected launch failure.
        }
        try require(!supervisor.snapshot().active, "launch failure left an active runtime")
        try require(!supervisor.snapshot().outputHandlerInstalled, "launch failure left stdout monitored")
        try require(!supervisor.snapshot().errorHandlerInstalled, "launch failure left stderr monitored")
        try startShell(supervisor, command: "exit 0", home: home)
        try require(waitUntil { !supervisor.isActive }, "restart after launch failure did not terminate")

        // Explicit Stop uses the same cleanup path and must permit restart.
        try startShell(supervisor, command: "cat >/dev/null", home: home)
        try require(waitUntil { supervisor.isRunning }, "long-running child did not start")
        supervisor.stop()
        try require(!supervisor.snapshot().active, "Stop left an active runtime")
        try require(!supervisor.snapshot().outputHandlerInstalled, "Stop left stdout monitored")
        try require(!supervisor.snapshot().errorHandlerInstalled, "Stop left stderr monitored")
        try startShell(supervisor, command: "exit 0", home: home)
        try require(waitUntil { !supervisor.isActive }, "restart after Stop did not terminate")

        // Repeated child exits exercise the exact former busy-loop trigger.
        let diskBeforeSoak = directoryBytes(home)
        let rssBeforeSoak = maximumResidentBytes()
        for iteration in 0..<100 {
            try startShell(
                supervisor,
                command: "printf o\(iteration); printf e\(iteration) >&2",
                home: home
            )
            try require(
                waitUntil { !supervisor.isActive },
                "soak child \(iteration) did not cleanly exit"
            )
        }
        let countsBeforeSoakIdle = counters.snapshot()
        let soakIdleCPUStart = cpuSeconds()
        usleep(1_000_000)
        let soakIdleCPU = cpuSeconds() - soakIdleCPUStart
        let countsAfterSoakIdle = counters.snapshot()
        let rssGrowth = maximumResidentBytes() - rssBeforeSoak
        let diskGrowth = directoryBytes(home) - diskBeforeSoak

        try require(countsBeforeSoakIdle == countsAfterSoakIdle, "soak callbacks did not quiesce")
        try require(soakIdleCPU < 0.15, "soak idle CPU gate failed: \(soakIdleCPU) seconds")
        try require(rssGrowth < 64 * 1_024 * 1_024, "soak RSS grew by \(rssGrowth) bytes")
        try require(diskGrowth == 0, "supervisor soak wrote \(diskGrowth) bytes")
        try require(!supervisor.snapshot().active, "soak left a runtime active")

        print(
            "PASS normal-exit launch-failure stop restart soak=100 " +
            "idleCPU=\(String(format: "%.4f", idleCPU))s " +
            "soakIdleCPU=\(String(format: "%.4f", soakIdleCPU))s " +
            "rssGrowth=\(rssGrowth) diskGrowth=\(diskGrowth)"
        )
    }
}

private extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try body()
    }
}
