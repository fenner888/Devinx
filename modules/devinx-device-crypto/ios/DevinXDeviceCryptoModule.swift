import CryptoKit
import ExpoModulesCore
import Foundation
import Security

public final class DevinXDeviceCryptoModule: Module {
  private static let keychainService = "com.fenner888.devinx.device-signing"
  private static let maximumMessageBytes = 1_048_576
  private static let ed25519SpkiPrefix = Data([
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
  ])

  public func definition() -> ModuleDefinition {
    Name("DevinXDeviceCrypto")

    AsyncFunction("createDeviceIdentity") { () throws -> [String: String] in
      let privateKey = Curve25519.Signing.PrivateKey()
      let keyId = UUID().uuidString.lowercased()
      try Self.storePrivateKey(privateKey.rawRepresentation, keyId: keyId)

      return [
        "keyId": keyId,
        "publicKeySpki": Self.base64UrlEncode(
          Self.ed25519SpkiPrefix + privateKey.publicKey.rawRepresentation
        ),
      ]
    }

    AsyncFunction("sign") { (keyId: String, message: String) throws -> String in
      let messageData = try Self.validatedMessage(message)
      var privateKeyData = try Self.readPrivateKey(keyId: keyId)
      defer { Self.zeroize(&privateKeyData) }

      let privateKey = try Curve25519.Signing.PrivateKey(rawRepresentation: privateKeyData)
      return Self.base64UrlEncode(try privateKey.signature(for: messageData))
    }

    AsyncFunction("verify") {
      (publicKeySpki: String, message: String, signature: String) throws -> Bool in
      let messageData = try Self.validatedMessage(message)
      let publicKeyData = try Self.rawPublicKey(from: publicKeySpki)
      let signatureData = try Self.base64UrlDecode(signature, expectedLength: 64)
      let publicKey = try Curve25519.Signing.PublicKey(rawRepresentation: publicKeyData)
      return publicKey.isValidSignature(signatureData, for: messageData)
    }

    AsyncFunction("hmacSha256") {
      (secret: String, message: String) throws -> String in
      let messageData = try Self.validatedMessage(message)
      var secretData = try Self.base64UrlDecode(secret, expectedLength: 32)
      defer { Self.zeroize(&secretData) }

      let authenticationCode = HMAC<SHA256>.authenticationCode(
        for: messageData,
        using: SymmetricKey(data: secretData)
      )
      return Self.base64UrlEncode(Data(authenticationCode))
    }

    AsyncFunction("hasDeviceIdentity") { (keyId: String) throws -> Bool in
      do {
        var privateKeyData = try Self.readPrivateKey(keyId: keyId)
        Self.zeroize(&privateKeyData)
        return true
      } catch DeviceCryptoError.keyNotFound {
        return false
      }
    }

    AsyncFunction("deleteDeviceIdentity") { (keyId: String) throws in
      try Self.deletePrivateKey(keyId: keyId)
    }

    AsyncFunction("deleteAllDeviceIdentities") { () throws in
      try Self.deleteAllPrivateKeys()
    }

    AsyncFunction("postPinnedJson") {
      (
        endpoint: String,
        path: String,
        certificateFingerprint: String,
        body: String,
        promise: Promise
      ) in
      do {
        let request = try PinnedHTTPSRequest(
          endpoint: endpoint,
          path: path,
          certificateFingerprint: certificateFingerprint,
          body: body
        )
        PinnedHTTPSClient.start(request: request, promise: promise)
      } catch {
        promise.reject(error)
      }
    }
  }

  private static func validatedKeyId(_ keyId: String) throws -> String {
    guard keyId.count == 36, UUID(uuidString: keyId) != nil else {
      throw DeviceCryptoError.invalidInput
    }
    return keyId.lowercased()
  }

  private static func validatedMessage(_ message: String) throws -> Data {
    let data = Data(message.utf8)
    guard !data.isEmpty, data.count <= maximumMessageBytes else {
      throw DeviceCryptoError.invalidInput
    }
    return data
  }

  private static func baseKeychainQuery() -> [CFString: Any] {
    [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: keychainService,
      kSecUseDataProtectionKeychain: true,
    ]
  }

  private static func storePrivateKey(_ privateKey: Data, keyId: String) throws {
    var query = baseKeychainQuery()
    query[kSecAttrAccount] = try validatedKeyId(keyId)
    query[kSecAttrAccessible] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    query[kSecValueData] = privateKey

    let status = SecItemAdd(query as CFDictionary, nil)
    guard status == errSecSuccess else {
      throw DeviceCryptoError.keychainFailure
    }
  }

  private static func readPrivateKey(keyId: String) throws -> Data {
    var query = baseKeychainQuery()
    query[kSecAttrAccount] = try validatedKeyId(keyId)
    query[kSecMatchLimit] = kSecMatchLimitOne
    query[kSecReturnData] = true

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecItemNotFound {
      throw DeviceCryptoError.keyNotFound
    }
    guard status == errSecSuccess,
          let data = item as? Data,
          data.count == 32 else {
      throw DeviceCryptoError.keychainFailure
    }
    return data
  }

  private static func deletePrivateKey(keyId: String) throws {
    var query = baseKeychainQuery()
    query[kSecAttrAccount] = try validatedKeyId(keyId)
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw DeviceCryptoError.keychainFailure
    }
  }

  private static func deleteAllPrivateKeys() throws {
    let status = SecItemDelete(baseKeychainQuery() as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw DeviceCryptoError.keychainFailure
    }
  }

  private static func rawPublicKey(from encodedSpki: String) throws -> Data {
    let spki = try base64UrlDecode(encodedSpki, expectedLength: 44)
    guard spki.prefix(ed25519SpkiPrefix.count) == ed25519SpkiPrefix else {
      throw DeviceCryptoError.invalidInput
    }
    return spki.dropFirst(ed25519SpkiPrefix.count)
  }

  private static func base64UrlEncode(_ data: Data) -> String {
    data.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }

  private static func base64UrlDecode(_ value: String, expectedLength: Int) throws -> Data {
    guard !value.isEmpty,
          value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
      throw DeviceCryptoError.invalidInput
    }

    let remainder = value.count % 4
    guard remainder != 1 else { throw DeviceCryptoError.invalidInput }
    let padding = remainder == 0 ? "" : String(repeating: "=", count: 4 - remainder)
    let standard = value
      .replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/") + padding

    guard let data = Data(base64Encoded: standard),
          data.count == expectedLength,
          base64UrlEncode(data) == value else {
      throw DeviceCryptoError.invalidInput
    }
    return data
  }

  private static func zeroize(_ data: inout Data) {
    guard !data.isEmpty else { return }
    data.resetBytes(in: 0..<data.count)
  }
}

private enum DeviceCryptoError: CodedError {
  case invalidInput
  case keyNotFound
  case keychainFailure

  var code: String {
    switch self {
    case .invalidInput:
      return "ERR_DEVICE_CRYPTO_INVALID_INPUT"
    case .keyNotFound:
      return "ERR_DEVICE_CRYPTO_KEY_NOT_FOUND"
    case .keychainFailure:
      return "ERR_DEVICE_CRYPTO_KEYCHAIN"
    }
  }

  var description: String {
    switch self {
    case .invalidInput:
      return "Device signing input is invalid"
    case .keyNotFound:
      return "Device signing identity was not found"
    case .keychainFailure:
      return "Device signing Keychain operation failed"
    }
  }
}
