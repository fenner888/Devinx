import CryptoKit
import Foundation
import Security

private struct ProbeInput: Decodable {
    let endpoint: String
    let certificateFingerprint: String
    let body: String
}

private final class ProbeDelegate: NSObject, URLSessionDataDelegate, URLSessionTaskDelegate {
    private let expectedHost: String
    private let expectedFingerprint: Data
    private let completion: (Result<(Int, Data), Error>) -> Void
    private var response: HTTPURLResponse?
    private var responseData = Data()
    private var finished = false

    init(expectedHost: String, expectedFingerprint: Data, completion: @escaping (Result<(Int, Data), Error>) -> Void) {
        self.expectedHost = expectedHost
        self.expectedFingerprint = expectedFingerprint
        self.completion = completion
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.previousFailureCount == 0,
              challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              challenge.protectionSpace.host == expectedHost,
              let trust = challenge.protectionSpace.serverTrust,
              let certificateChain = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
              let certificate = certificateChain.first,
              Data(SHA256.hash(data: SecCertificateCopyData(certificate) as Data)) == expectedFingerprint,
              SecTrustSetPolicies(trust, SecPolicyCreateBasicX509()) == errSecSuccess,
              SecTrustSetAnchorCertificates(trust, [certificate] as CFArray) == errSecSuccess,
              SecTrustSetAnchorCertificatesOnly(trust, true) == errSecSuccess,
              SecTrustEvaluateWithError(trust, nil) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            complete(.failure(ProbeError.certificateMismatch))
            return
        }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        guard let response = response as? HTTPURLResponse else {
            completionHandler(.cancel)
            complete(.failure(ProbeError.invalidResponse))
            return
        }
        self.response = response
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        responseData.append(data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error {
            complete(.failure(error))
            return
        }
        guard let response else {
            complete(.failure(ProbeError.invalidResponse))
            return
        }
        complete(.success((response.statusCode, responseData)))
    }

    private func complete(_ result: Result<(Int, Data), Error>) {
        guard !finished else { return }
        finished = true
        completion(result)
    }
}

private enum ProbeError: Error {
    case invalidInput
    case certificateMismatch
    case invalidResponse
    case timeout
}

private func decodeBase64Url(_ value: String) -> Data? {
    let remainder = value.count % 4
    guard remainder != 1 else { return nil }
    let padding = remainder == 0 ? "" : String(repeating: "=", count: 4 - remainder)
    return Data(base64Encoded: value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/") + padding)
}

let semaphore = DispatchSemaphore(value: 0)
var probeResult: Result<(Int, Data), Error>?

do {
    let input = try JSONDecoder().decode(ProbeInput.self, from: FileHandle.standardInput.readDataToEndOfFile())
    guard let endpoint = URL(string: input.endpoint),
          let host = endpoint.host,
          let requestURL = URL(string: String(input.endpoint.dropLast()) + "/v1/pair/submit"),
          let fingerprint = decodeBase64Url(input.certificateFingerprint),
          fingerprint.count == 32 else {
        throw ProbeError.invalidInput
    }

    let configuration = URLSessionConfiguration.ephemeral
    configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
    configuration.urlCache = nil
    configuration.httpCookieStorage = nil
    configuration.connectionProxyDictionary = [:]
    configuration.protocolClasses = []
    configuration.httpShouldSetCookies = false
    configuration.httpMaximumConnectionsPerHost = 1
    configuration.timeoutIntervalForRequest = 20
    configuration.timeoutIntervalForResource = 30
    configuration.waitsForConnectivity = true

    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    let delegate = ProbeDelegate(expectedHost: host, expectedFingerprint: fingerprint) { result in
        probeResult = result
        semaphore.signal()
    }
    let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: queue)
    var request = URLRequest(url: requestURL)
    request.httpMethod = "POST"
    request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
    request.timeoutInterval = 20
    request.httpBody = Data(input.body.utf8)
    request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
    request.setValue(String(Data(input.body.utf8).count), forHTTPHeaderField: "Content-Length")
    request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
    session.dataTask(with: request).resume()

    guard semaphore.wait(timeout: .now() + 20) == .success, let probeResult else {
        throw ProbeError.timeout
    }
    switch probeResult {
    case let .success((status, data)):
        let body = String(data: data, encoding: .utf8) ?? ""
        let output: [String: Any] = ["status": status, "body": body]
        let encoded = try JSONSerialization.data(withJSONObject: output)
        FileHandle.standardOutput.write(encoded)
        FileHandle.standardOutput.write(Data("\n".utf8))
    case let .failure(error):
        throw error
    }
} catch {
    let output = ["error": String(describing: error)]
    let encoded = try JSONSerialization.data(withJSONObject: output)
    FileHandle.standardOutput.write(encoded)
    FileHandle.standardOutput.write(Data("\n".utf8))
    exit(1)
}
