import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AcpSessionClient } from '../../bridge/src/acp';

describe('ACP session client', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    delete process.env.DEVINX_TEST_SECRET;
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  function fakeCli(body: string): string {
    const directory = mkdtempSync(join(tmpdir(), 'devinx-acp-client-'));
    temporaryDirectories.push(directory);
    const executable = join(directory, 'devin');
    writeFileSync(
      executable,
      `#!/usr/bin/env node
if (process.argv.length !== 3 || process.argv[2] !== 'acp') process.exit(2);
let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk.toString('utf8');
  const lines = input.split(/\\r?\\n/);
  input = lines.pop() || '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const request = JSON.parse(line);
    ${body}
  }
});
`,
      { encoding: 'utf8' },
    );
    chmodSync(executable, 0o700);
    return executable;
  }

  it('initializes, capability-gates, and returns minimized validated session metadata', async () => {
    process.env.DEVINX_TEST_SECRET = 'must-not-forward';
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      protocolVersion: 1,
      agentCapabilities: { sessionCapabilities: { list: {} } },
      _meta: { privateInitialization: 'drop-me' }
    }
  }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      sessions: [{
        sessionId: 'session-123',
        cwd: '/Users/example/project',
        additionalDirectories: ['/Users/example/shared'],
        title: process.env.DEVINX_TEST_SECRET ||
          (process.cwd() === process.env.HOME ? 'safe-title' : 'wrong-working-directory'),
        updatedAt: '2026-07-10T12:00:00Z',
        privateExtension: 'drop-extension-value',
        _meta: { privateToken: 'drop-metadata-value' }
      }],
      nextCursor: request.params.cursor ? undefined : 'opaque-next-cursor',
      privateResponse: 'drop-response-value'
    }
  }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      const page = await client.listSessions({});
      expect(page).toEqual({
        sessions: [
          {
            sessionId: 'session-123',
            cwd: '/Users/example/project',
            additionalDirectories: ['/Users/example/shared'],
            title: 'safe-title',
            updatedAt: '2026-07-10T12:00:00Z',
          },
        ],
        nextCursor: 'opaque-next-cursor',
      });
      expect(JSON.stringify(page)).not.toContain('drop-extension-value');
      expect(JSON.stringify(page)).not.toContain('drop-metadata-value');
      expect(JSON.stringify(page)).not.toContain('drop-response-value');
      expect(JSON.stringify(page)).not.toContain('must-not-forward');
    } finally {
      await client.stop();
    }
  });

  it('never sends session/list when the capability is absent', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result: { protocolVersion: 1, agentCapabilities: {} }
  }) + '\\n');
} else if (request.method === 'session/list') {
  process.exit(9);
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      await expect(client.listSessions()).rejects.toThrow('does not support session listing');
    } finally {
      await client.stop();
    }
  });

  it('decodes UTF-8 JSON safely when a character spans stdout chunks', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      protocolVersion: 1,
      agentCapabilities: { sessionCapabilities: { list: {} } }
    }
  }) + '\\n');
} else if (request.method === 'session/list') {
  const payload = Buffer.from(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result: { sessions: [{ sessionId: 'session-utf8', cwd: '/tmp', title: 'Devin 🦦' }] }
  }) + '\\n', 'utf8');
  const marker = payload.indexOf(Buffer.from('🦦'));
  process.stdout.write(payload.subarray(0, marker + 1));
  setTimeout(() => process.stdout.write(payload.subarray(marker + 1)), 10);
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      await expect(client.listSessions()).resolves.toMatchObject({
        sessions: [{ title: 'Devin 🦦' }],
      });
    } finally {
      await client.stop();
    }
  });

  it.each([
    [
      'relative workspace paths',
      [{ sessionId: 'session-relative', cwd: 'relative/path' }],
    ],
    [
      'invalid metadata shapes',
      [{ sessionId: 'session-meta', cwd: '/tmp', _meta: 'invalid' }],
    ],
    [
      'duplicate session IDs',
      [
        { sessionId: 'session-duplicate', cwd: '/tmp/one' },
        { sessionId: 'session-duplicate', cwd: '/tmp/two' },
      ],
    ],
  ])('fails closed on %s', async (_label, sessions) => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      protocolVersion: 1,
      agentCapabilities: { sessionCapabilities: { list: {} } }
    }
  }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      sessions: ${JSON.stringify(sessions)}
    }
  }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    await client.start();
    await expect(client.listSessions()).rejects.toThrow('response failed validation');
    await expect(client.listSessions()).rejects.toThrow('not started');
    await client.stop();
  });

  it('terminates when initialization times out', async () => {
    const executablePath = fakeCli(`void request;`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 75 });

    await expect(client.start()).rejects.toThrow('initialization timed out');
    await client.stop();
  });

  it('rejects an oversized JSON-RPC line before parsing it', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write('x'.repeat(1024 * 1024 + 1));
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    await expect(client.start()).rejects.toThrow('size limit');
    await client.stop();
  });
});
