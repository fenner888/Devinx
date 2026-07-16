import {
  isConnectorUpdateRequired,
  MINIMUM_SUPPORTED_CONNECTOR_VERSION,
} from '../../src/lib/connectorVersion';

describe('Connector version compatibility', () => {
  it('requires legacy versions while accepting the minimum and newer versions', () => {
    expect(MINIMUM_SUPPORTED_CONNECTOR_VERSION).toBe('0.1.2');
    expect(isConnectorUpdateRequired('0.1.1')).toBe(true);
    expect(isConnectorUpdateRequired('0.1.2')).toBe(false);
    expect(isConnectorUpdateRequired('0.2.0')).toBe(false);
    expect(isConnectorUpdateRequired('1.0.0')).toBe(false);
  });

  it('fails closed for malformed version strings', () => {
    expect(isConnectorUpdateRequired('0.1')).toBe(true);
    expect(isConnectorUpdateRequired('latest')).toBe(true);
  });
});
