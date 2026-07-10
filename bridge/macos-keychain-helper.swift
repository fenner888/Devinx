import Foundation
import Security

private let itemNotFoundExitCode: Int32 = 44
private let maximumSecretBytes = 1_048_576

private func exitWithError(_ message: String, status: OSStatus? = nil) -> Never {
    let suffix = status.map { " (OSStatus \($0))" } ?? ""
    FileHandle.standardError.write(Data("\(message)\(suffix)\n".utf8))
    exit(1)
}

private func baseQuery(service: String, account: String) -> [String: Any] {
    [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
    ]
}

let arguments = CommandLine.arguments
guard arguments.count == 4 else {
    exitWithError("Keychain helper arguments are invalid")
}

let operation = arguments[1]
let service = arguments[2]
let account = arguments[3]
guard !service.isEmpty, service.utf8.count <= 255,
      !account.isEmpty, account.utf8.count <= 255 else {
    exitWithError("Keychain helper item identity is invalid")
}

let query = baseQuery(service: service, account: account)

switch operation {
case "get":
    var getQuery = query
    getQuery[kSecReturnData as String] = true
    getQuery[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(getQuery as CFDictionary, &result)
    if status == errSecItemNotFound {
        exit(itemNotFoundExitCode)
    }
    guard status == errSecSuccess, let data = result as? Data else {
        exitWithError("Keychain read failed", status: status)
    }
    FileHandle.standardOutput.write(data)

case "set":
    let value = FileHandle.standardInput.readDataToEndOfFile()
    guard !value.isEmpty, value.count <= maximumSecretBytes else {
        exitWithError("Keychain value is invalid")
    }
    let updateStatus = SecItemUpdate(
        query as CFDictionary,
        [kSecValueData as String: value] as CFDictionary
    )
    if updateStatus == errSecItemNotFound {
        var newItem = query
        newItem[kSecValueData as String] = value
        let addStatus = SecItemAdd(newItem as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            exitWithError("Keychain write failed", status: addStatus)
        }
    } else if updateStatus != errSecSuccess {
        exitWithError("Keychain write failed", status: updateStatus)
    }

case "delete":
    let status = SecItemDelete(query as CFDictionary)
    if status != errSecSuccess && status != errSecItemNotFound {
        exitWithError("Keychain delete failed", status: status)
    }

default:
    exitWithError("Keychain helper operation is invalid")
}
