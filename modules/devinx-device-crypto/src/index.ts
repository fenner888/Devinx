export {
  createDeviceIdentity,
  deleteAllDeviceIdentities,
  deleteDeviceIdentity,
  fingerprintPublicKeySpki,
  hasDeviceIdentity,
  hmacSha256,
  isDeviceCryptoAvailable,
  isPinnedBridgeTransportAvailable,
  postPinnedBridgeJson,
  sign,
  verify,
} from '../../../src/auth/deviceSigning';
