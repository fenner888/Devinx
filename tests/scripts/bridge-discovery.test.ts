import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

describe('ACP bridge discovery probe', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('prints only sanitized initialization capabilities', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devinx-fake-cli-'));
    temporaryDirectories.push(directory);
    const fakeCli = join(directory, 'devin');
    writeFileSync(
      fakeCli,
      `#!/usr/bin/env node
const command = process.argv[2];
if (command === 'version') {
  process.stdout.write('devin test-version\\n');
} else if (command === 'acp') {
  process.stdin.once('data', (chunk) => {
    const request = JSON.parse(chunk.toString('utf8'));
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: 1,
        agentInfo: { name: 'Devin CLI', version: 'test-agent' },
        agentCapabilities: {
          promptCapabilities: { audio: false, image: true },
          sessionCapabilities: { close: null, list: {}, resume: {} }
        },
        authMethods: [{ id: 'private-auth-method' }],
        _meta: { secret: 'must-not-appear' }
      }
    }) + '\\n');
  });
} else {
  process.exitCode = 2;
}
`,
      { encoding: 'utf8' },
    );
    chmodSync(fakeCli, 0o700);

    const script = resolve(process.cwd(), 'scripts/bridge/discover-acp.mjs');
    const output = execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        DEVIN_CLI_PATH: fakeCli,
        DEVIN_BRIDGE_DISCOVERY_TIMEOUT_MS: '2000',
      },
    });
    const report = JSON.parse(output) as {
      acp: { capabilities: string[]; negotiatedProtocolVersion: number };
      cli: { version: string };
      probeVersion: number;
    };

    expect(report).toEqual(
      expect.objectContaining({
        probeVersion: 1,
        cli: { version: 'devin test-version' },
        acp: expect.objectContaining({
          negotiatedProtocolVersion: 1,
          capabilities: [
            'promptCapabilities.image',
            'sessionCapabilities.list',
            'sessionCapabilities.resume',
          ],
        }),
      }),
    );
    expect(output).not.toContain('must-not-appear');
    expect(output).not.toContain('private-auth-method');
  });
});
