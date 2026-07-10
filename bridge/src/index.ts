export { canonicalJson } from './canonical';
export {
  AcpSessionClient,
  type AcpClientOptions,
  type AcpSessionMetadata,
  type AcpSessionPage,
} from './acp';
export { InMemoryReplayGuard, type ReplayGuard } from './replay';
export {
  FixedWindowRateLimiter,
  type RateLimiter,
  type RateLimitRule,
} from './rate-limit';
export { SessionHandleRegistry } from './session-handles';
export {
  MacOSKeychainSecretStore,
  type KeychainSecretStore,
  type MacOSKeychainOptions,
} from './macos-keychain';
export {
  HttpsBridgeListener,
  type HttpsBridgeListenerAddress,
  type HttpsBridgeListenerOptions,
} from './listener';
export {
  DesktopBridgeStateRepository,
  PersistentDeviceRegistry,
  loadDesktopBridgeRuntime,
  type DesktopBridgeRuntimeState,
  type DesktopBridgeState,
  type DeviceSummary,
} from './state';
export {
  BridgeService,
  type BridgeRequestContext,
  type BridgeServiceOptions,
  type BridgeServiceResponse,
  type SessionDiscoveryAdapter,
} from './service';
export {
  PairingManager,
  createPairingProof,
  devicePermissionUpdateSchema,
  pairingOfferSchema,
  pairingReceiptSchema,
  pairingRequestSchema,
  revokeDeviceRecord,
  signedPairingReceiptSchema,
  unsignedPairingRequestSchema,
  updateDevicePermissions,
  verifyPairingReceipt,
  type BridgePairingIdentity,
  type DevicePermissionUpdate,
  type PairingApprovalResult,
  type PairingDeviceRegistry,
  type PairingManagerOptions,
  type PairingOffer,
  type PairingReceipt,
  type PairingRequest,
  type PairingSubmissionResult,
  type PendingPairingReview,
  type SignedPairingReceipt,
  type UnsignedPairingRequest,
} from './pairing';
export {
  authorizeRequest,
  signingPayload,
  type AuthorizationContext,
  type AuthorizedRequest,
  type DeviceStore,
  type RequestAuthorization,
  type RequestRejection,
} from './security';
export {
  BRIDGE_PROTOCOL_VERSION,
  bridgeMethodSchema,
  bridgePermissionSchema,
  deviceNameSchema,
  deviceRecordSchema,
  opaqueIdSchema,
  sessionIdSchema,
  signedRequestEnvelopeSchema,
  type BridgeBodyByMethod,
  type BridgeMethod,
  type BridgePermission,
  type DeviceRecord,
  type SignedRequestEnvelope,
} from './schemas';
