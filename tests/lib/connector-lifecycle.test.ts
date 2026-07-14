import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const connectorSource = readFileSync(
  resolve(__dirname, '../../connector/macos/DevinXConnector.swift'),
  'utf8',
);

describe('macOS Connector lifecycle', () => {
  it('keeps the runtime available after the window closes and exposes explicit menu actions', () => {
    expect(connectorSource).toMatch(
      /applicationShouldTerminateAfterLastWindowClosed[\s\S]*?\n\s*false/,
    );
    expect(connectorSource).toContain('window.isReleasedWhenClosed = false');
    expect(connectorSource).toContain('NSStatusBar.system.statusItem');
    expect(connectorSource).toContain('Open DevinX Connector');
    expect(connectorSource).toContain('Quit DevinX Connector');
    expect(connectorSource).toContain('NSApplication.shared.setActivationPolicy(.accessory)');
  });
});
