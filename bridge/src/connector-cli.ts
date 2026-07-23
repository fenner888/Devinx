import { ConnectorController } from './connector-controller';
import { CONNECTOR_IPC_VERSION, encodeConnectorEvent } from './connector-ipc';

export function connectorStartupErrorCode(
  error: unknown,
): 'bridge_start_failed' | 'tailscale_unavailable' | 'unsupported_platform' {
  if (
    error instanceof Error &&
    (error.message.startsWith('The Linux DevinX Connector adapter') ||
      error.message.startsWith('This operating system is not supported'))
  ) {
    return 'unsupported_platform';
  }
  return error instanceof Error && error.message.startsWith('Tailscale is not connected')
    ? 'tailscale_unavailable'
    : 'bridge_start_failed';
}

export async function main(): Promise<void> {
  if (process.stdout.isTTY) {
    throw new Error('DevinX Connector controller must be launched by the desktop application');
  }
  const controller = new ConnectorController({
    input: process.stdin,
    output: process.stdout,
  });
  const stop = () => {
    controller.stop().catch(() => {});
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await controller.run();
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    process.stdout.write(
      encodeConnectorEvent({
        version: CONNECTOR_IPC_VERSION,
        type: 'error',
        code: connectorStartupErrorCode(error),
      }),
    );
    process.exitCode = 1;
  });
}
