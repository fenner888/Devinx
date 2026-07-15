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
          sessionCapabilities: { close: null, list: {}, resume: {} },
          secretCapabilityName: true
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
      acp: {
        capabilities: string[];
        negotiatedProtocolVersion: number;
        unknownCapabilityCount: number;
      };
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
          unknownCapabilityCount: 1,
        }),
      }),
    );
    expect(output).not.toContain('must-not-appear');
    expect(output).not.toContain('private-auth-method');
    expect(output).not.toContain('secretCapabilityName');
  });

  it('summarizes session-list shape without printing session values', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devinx-fake-cli-'));
    temporaryDirectories.push(directory);
    const fakeCli = join(directory, 'devin');
    writeFileSync(
      fakeCli,
      `#!/usr/bin/env node
const command = process.argv[2];
if (command === 'version') {
  process.stdout.write('devin session-schema-version\\n');
} else if (command === 'acp') {
  let input = '';
  process.stdin.on('data', (chunk) => {
    input += chunk.toString('utf8');
    const lines = input.split(/\\r?\\n/);
    input = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const request = JSON.parse(line);
      if (request.method === 'initialize') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: 1,
            agentInfo: { name: 'Devin CLI', version: 'test-agent' },
            agentCapabilities: { sessionCapabilities: { list: {} } }
          }
        }) + '\\n');
      } else if (request.method === 'session/list') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            sessions: [{
              sessionId: 'secret-session-id',
              cwd: '/Users/private/secret-project',
              additionalDirectories: ['/Users/private/secret-library'],
              title: 'Secret task title',
              updatedAt: '2026-07-10T12:00:00Z',
              privateExtension: 'secret-extension-value',
              _meta: { privateToken: 'secret-metadata-value' }
            }],
            nextCursor: 'secret-pagination-cursor'
          }
        }) + '\\n');
      }
    }
  });
} else {
  process.exitCode = 2;
}
`,
      { encoding: 'utf8' },
    );
    chmodSync(fakeCli, 0o700);

    const script = resolve(process.cwd(), 'scripts/bridge/discover-acp.mjs');
    const output = execFileSync(process.execPath, [script, '--session-schema'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        DEVIN_CLI_PATH: fakeCli,
        DEVIN_BRIDGE_DISCOVERY_TIMEOUT_MS: '2000',
      },
    });
    const report = JSON.parse(output) as {
      acp: {
        sessionList: {
          hasNextPage: boolean;
          itemCount: number;
          recognizedSessionFields: string[];
          responseFields: string[];
          unknownSessionFieldCount: number;
        };
      };
    };

    expect(report.acp.sessionList).toEqual({
      itemCount: 1,
      responseFields: ['sessions', 'nextCursor'],
      recognizedSessionFields: [
        '_meta',
        'additionalDirectories',
        'cwd',
        'sessionId',
        'title',
        'updatedAt',
      ],
      unknownSessionFieldCount: 1,
      hasNextPage: true,
    });
    for (const privateValue of [
      'secret-session-id',
      '/Users/private/secret-project',
      '/Users/private/secret-library',
      'Secret task title',
      '2026-07-10T12:00:00Z',
      'privateExtension',
      'secret-extension-value',
      'secret-pagination-cursor',
      'privateToken',
      'secret-metadata-value',
    ]) {
      expect(output).not.toContain(privateValue);
    }
  });
});
