import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const connectorSource = readFileSync(
  resolve(__dirname, '../../connector/macos/DevinXConnector.swift'),
  'utf8',
);
const supervisorSource = readFileSync(
  resolve(__dirname, '../../connector/macos/ConnectorProcessSupervisor.swift'),
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
      /private func runtimeDidTerminate\(_ terminationStatus: Int32\) \{[\s\S]*?if uninstalling \{[\s\S]*?removeProtectedStateWithHelper\(\)/,
    );
    expect(connectorSource).toMatch(
      /if runtime\.isRunning \{[\s\S]*?type": "reset"[\s\S]*?\} else \{[\s\S]*?removeProtectedStateWithHelper\(\)/,
    );
  });

  it('owns stdout and stderr handlers in one idempotent cleanup path', () => {
    expect(connectorSource).toContain('private let runtime = ConnectorProcessSupervisor()');
    expect(supervisorSource).toContain('private func handleEOF');
    expect(supervisorSource).toContain('private func finish');
    expect(supervisorSource).toContain('context.cleaned = true');
    expect(supervisorSource).toContain('readabilityHandler = nil');
    expect(supervisorSource).toContain('close(context.error.fileHandleForWriting)');
  });

  it('shows the newest paired iPhone first and marks that row as most recent', () => {
    expect(connectorSource).toContain('$0.pairedAt > $1.pairedAt');
    expect(connectorSource).toContain('device.id == model.devices.first?.id');
  });
});
