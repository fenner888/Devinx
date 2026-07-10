import CryptoKit
import ExpoModulesCore
import Foundation
import Network
import Security

private let maximumBodyBytes = 256 * 1024
private let allowedPaths = Set([
  "/v1/pair/submit",
  "/v1/pair/status",
  "/v1/request",
])
private let allowedStatuses = Set([200, 202, 400, 404, 429, 503])

struct PinnedHTTPSRequest {
  let url: URL
  let endpointHost: String
  let certificateFingerprint: Data
  let body: Data

  init(
    endpoint: String,
    path: String,
    certificateFingerprint: String,
    body: String
  ) throws {
    guard allowedPaths.contains(path),
          let components = URLComponents(string: endpoint),
          components.scheme == "https",
          components.user == nil,
          components.password == nil,
          components.path == "/",
          components.query == nil,
          components.fragment == nil,
          let componentHost = components.host,
          let port = components.port,
          (1...65_535).contains(port),
          components.url?.absoluteString == endpoint,
          let host = components.url?.host,
          componentHost == host || componentHost == "[\(host)]",
          Self.isPrivateNetworkAddress(host),
          let url = URL(string: String(endpoint.dropLast()) + path),
          url.host == host,
          url.port == port else {
      throw PinnedHTTPSError.invalidInput
    }

    let fingerprint = try Self.base64UrlDecode(certificateFingerprint, expectedLength: 32)
    let bodyData = Data(body.utf8)
    guard !bodyData.isEmpty,
          bodyData.count <= maximumBodyBytes,
          let json = try? JSONSerialization.jsonObject(with: bodyData),
          json is [String: Any] else {
      throw PinnedHTTPSError.invalidInput
    }

    self.url = url
    self.endpointHost = host
    self.certificateFingerprint = fingerprint
    self.body = bodyData
  }

  private static func isPrivateNetworkAddress(_ host: String) -> Bool {
    if let address = IPv4Address(host) {
      let bytes = [UInt8](address.rawValue)
      guard bytes.count == 4 else { return false }
      return bytes[0] == 10 ||
        bytes[0] == 127 ||
        (bytes[0] == 100 && (64...127).contains(bytes[1])) ||
        (bytes[0] == 169 && bytes[1] == 254) ||
        (bytes[0] == 172 && (16...31).contains(bytes[1])) ||
        (bytes[0] == 192 && bytes[1] == 168)
    }
    if let address = IPv6Address(host) {
      let bytes = [UInt8](address.rawValue)
      guard bytes.count == 16 else { return false }
      let isLoopback = bytes.dropLast().allSatisfy { $0 == 0 } && bytes[15] == 1
      let isUniqueLocal = bytes[0] & 0xfe == 0xfc
      let isLinkLocal = bytes[0] == 0xfe && bytes[1] & 0xc0 == 0x80
      return isLoopback || isUniqueLocal || isLinkLocal
    }
    return false
  }

  private static func base64UrlDecode(_ value: String, expectedLength: Int) throws -> Data {
    guard !value.isEmpty,
          value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
      throw PinnedHTTPSError.invalidInput
    }
    let remainder = value.count % 4
    guard remainder != 1 else { throw PinnedHTTPSError.invalidInput }
    let padding = remainder == 0 ? "" : String(repeating: "=", count: 4 - remainder)
    let standard = value
      .replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/") + padding
    guard let data = Data(base64Encoded: standard),
          data.count == expectedLength,
          base64UrlEncode(data) == value else {
      throw PinnedHTTPSError.invalidInput
    }
    return data
  }

  private static func base64UrlEncode(_ data: Data) -> String {
    data.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }
}

enum PinnedHTTPSClient {
  static func start(request: PinnedHTTPSRequest, promise: Promise) {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
    configuration.urlCache = nil
    configuration.httpCookieStorage = nil
    configuration.connectionProxyDictionary = [:]
    configuration.protocolClasses = []
    configuration.httpShouldSetCookies = false
    configuration.httpShouldUsePipelining = false
    configuration.httpMaximumConnectionsPerHost = 1
    configuration.timeoutIntervalForRequest = 10
    configuration.timeoutIntervalForResource = 15
    configuration.waitsForConnectivity = false

    let queue = OperationQueue()
    queue.name = "com.fenner888.devinx.pinned-https"
    queue.maxConcurrentOperationCount = 1
    queue.qualityOfService = .userInitiated

    let delegate = PinnedHTTPSDelegate(request: request, promise: promise)
    let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: queue)
    delegate.attach(session: session)

    var urlRequest = URLRequest(url: request.url)
    urlRequest.httpMethod = "POST"
    urlRequest.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
    urlRequest.timeoutInterval = 10
    urlRequest.httpBody = request.body
    urlRequest.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
    urlRequest.setValue(String(request.body.count), forHTTPHeaderField: "Content-Length")
    urlRequest.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
    session.dataTask(with: urlRequest).resume()
  }
}

private final class PinnedHTTPSDelegate: NSObject, URLSessionDataDelegate, URLSessionTaskDelegate {
  private let expectedHost: String
  private var expectedFingerprint: Data
  private var promise: Promise?
  private var session: URLSession?
  private var response: HTTPURLResponse?
  private var responseData = Data()
  private var settled = false

  init(request: PinnedHTTPSRequest, promise: Promise) {
    self.expectedHost = request.endpointHost
    self.expectedFingerprint = request.certificateFingerprint
    self.promise = promise
  }

  func attach(session: URLSession) {
    self.session = session
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
          let certificate = certificateChain.first else {
      completionHandler(.cancelAuthenticationChallenge, nil)
      finish(error: .certificateMismatch)
      return
    }
    let certificateData = SecCertificateCopyData(certificate) as Data
    let fingerprint = Data(SHA256.hash(data: certificateData))
    guard Self.constantTimeEqual(fingerprint, expectedFingerprint) else {
      completionHandler(.cancelAuthenticationChallenge, nil)
      finish(error: .certificateMismatch)
      return
    }
    completionHandler(.useCredential, URLCredential(trust: trust))
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
    finish(error: .invalidResponse)
  }

  func urlSession(
    _ session: URLSession,
    dataTask: URLSessionDataTask,
    didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
  ) {
    guard let response = response as? HTTPURLResponse,
          allowedStatuses.contains(response.statusCode),
          response.mimeType?.lowercased() == "application/json",
          response.value(forHTTPHeaderField: "Content-Encoding") == nil,
          response.expectedContentLength <= Int64(maximumBodyBytes) else {
      completionHandler(.cancel)
      finish(error: .invalidResponse)
      return
    }
    self.response = response
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    guard !settled else { return }
    guard data.count <= maximumBodyBytes,
          responseData.count <= maximumBodyBytes - data.count else {
      finish(error: .responseTooLarge)
      return
    }
    responseData.append(data)
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didCompleteWithError error: Error?
  ) {
    guard !settled else { return }
    guard error == nil else {
      finish(error: .networkFailure)
      return
    }
    guard let response,
          !responseData.isEmpty,
          let text = String(data: responseData, encoding: .utf8),
          let json = try? JSONSerialization.jsonObject(with: responseData),
          json is [String: Any] else {
      finish(error: .invalidResponse)
      return
    }
    finish(value: ["status": response.statusCode, "body": text])
  }

  private func finish(value: [String: Any]? = nil, error: PinnedHTTPSError? = nil) {
    guard !settled else { return }
    settled = true
    if !responseData.isEmpty {
      responseData.resetBytes(in: 0..<responseData.count)
    }
    if !expectedFingerprint.isEmpty {
      expectedFingerprint.resetBytes(in: 0..<expectedFingerprint.count)
    }
    let promise = self.promise
    self.promise = nil
    let session = self.session
    self.session = nil
    if let value {
      session?.finishTasksAndInvalidate()
      promise?.resolve(value)
    } else {
      session?.invalidateAndCancel()
      promise?.reject(error ?? PinnedHTTPSError.networkFailure)
    }
  }

  private static func constantTimeEqual(_ first: Data, _ second: Data) -> Bool {
    guard first.count == second.count else { return false }
    var difference: UInt8 = 0
    for index in first.indices {
      difference |= first[index] ^ second[index]
    }
    return difference == 0
  }
}

enum PinnedHTTPSError: CodedError {
  case invalidInput
  case certificateMismatch
  case responseTooLarge
  case invalidResponse
  case networkFailure

  var code: String {
    switch self {
    case .invalidInput:
      return "ERR_PINNED_HTTPS_INVALID_INPUT"
    case .certificateMismatch:
      return "ERR_PINNED_HTTPS_CERTIFICATE_MISMATCH"
    case .responseTooLarge:
      return "ERR_PINNED_HTTPS_RESPONSE_TOO_LARGE"
    case .invalidResponse:
      return "ERR_PINNED_HTTPS_INVALID_RESPONSE"
    case .networkFailure:
      return "ERR_PINNED_HTTPS_NETWORK"
    }
  }

  var description: String {
    switch self {
    case .invalidInput:
      return "Pinned bridge request input is invalid"
    case .certificateMismatch:
      return "The bridge certificate did not match the paired fingerprint"
    case .responseTooLarge:
      return "The bridge response exceeded the size limit"
    case .invalidResponse:
      return "The bridge returned an invalid response"
    case .networkFailure:
      return "The bridge could not be reached securely"
    }
  }
}
