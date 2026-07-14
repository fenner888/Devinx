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

  it('can remove protected state when the bridge runtime is unavailable during uninstall', () => {
    expect(connectorSource).toContain('private func removeProtectedStateWithHelper()');
    expect(connectorSource).toContain(
      'task.arguments = ["delete", keychainService, keychainAccount]',
    );
    expect(connectorSource).toMatch(
      /if self\.uninstalling \{[\s\S]*?self\.removeProtectedStateWithHelper\(\)/,
    );
    expect(connectorSource).toMatch(
      /if process\?\.isRunning == true \{[\s\S]*?type": "reset"[\s\S]*?\} else \{[\s\S]*?removeProtectedStateWithHelper\(\)/,
    );
  });
});
