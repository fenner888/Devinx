import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AcpSessionClient,
  isAcpSessionInUseError,
  parseAcpModelCatalog,
} from '../../bridge/src/acp';

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
    execFileSync(process.execPath, ['--check', executable]);
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

  it('capability-gates load, uses listed cwd with no MCP roots, and minimizes replayed history', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      protocolVersion: 1,
      agentCapabilities: { loadSession: true, sessionCapabilities: { list: {} } }
    }
  }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id: request.id,
    result: { sessions: [{ sessionId: 'session-load', cwd: '/Users/example/project' }] }
  }) + '\\n');
} else if (request.method === 'session/load') {
  if (request.params.cwd !== '/Users/example/project' ||
      request.params.sessionId !== 'session-load' ||
      JSON.stringify(request.params.mcpServers) !== '[]' ||
      'additionalDirectories' in request.params) process.exit(12);
  const updates = [
    { sessionUpdate: 'user_message_chunk', messageId: 'raw-user-id', content: { type: 'text', text: 'Hello ' } },
    { sessionUpdate: 'user_message_chunk', messageId: 'raw-user-id', content: { type: 'text', text: 'Devin' } },
    { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'private-reasoning' } },
    { sessionUpdate: 'tool_call', toolCallId: 'tool-secret', title: 'Private tool', rawInput: { token: 'private-token' } },
    { sessionUpdate: 'agent_message_chunk', messageId: 'raw-agent-id', content: { type: 'image', data: 'private-image' } },
    { sessionUpdate: 'agent_message_chunk', messageId: 'raw-agent-id', content: { type: 'text', text: 'Ready.' }, privateExtension: 'drop-me' },
  ];
  for (const update of updates) {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0', method: 'session/update',
      params: { sessionId: 'session-load', update, _meta: { private: 'drop-meta' } }
    }) + '\\n');
  }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: null }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      expect(client.isSessionLoadSupported()).toBe(true);
      await expect(client.loadSession('session-load')).rejects.toThrow('listed before loading');
      await client.listSessions();
      const loaded = await client.loadSession('session-load');
      expect(loaded).toEqual({
        sessionId: 'session-load',
        cwd: '/Users/example/project',
        messages: [
          { source: 'user', text: 'Hello Devin' },
          { source: 'devin', text: 'Ready.' },
        ],
        truncated: false,
      });
      expect(JSON.stringify(loaded)).not.toMatch(
        /raw-user-id|raw-agent-id|private-reasoning|private-token|private-image|drop-me|drop-meta/,
      );
    } finally {
      await client.stop();
    }
  });

  it('keeps no-ID user turns separate across private replay boundaries', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    protocolVersion: 1, agentCapabilities: { loadSession: true, sessionCapabilities: { list: {} } }
  } }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    sessions: [{ sessionId: 'session-boundaries', cwd: '/tmp/project' }]
  } }) + '\\n');
} else if (request.method === 'session/load') {
  const updates = [
    { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'First ' } },
    { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'turn.' } },
    { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'private' } },
    { sessionUpdate: 'tool_call', title: 'private tool' },
    { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'Second turn.' } },
    { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Done.' } },
  ];
  for (const update of updates) process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', method: 'session/update',
    params: { sessionId: 'session-boundaries', update }
  }) + '\\n');
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: null }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      await client.listSessions();
      await expect(client.loadSession('session-boundaries')).resolves.toMatchObject({
        messages: [
          { source: 'user', text: 'First turn.' },
          { source: 'user', text: 'Second turn.' },
          { source: 'devin', text: 'Done.' },
        ],
      });
    } finally {
      await client.stop();
    }
  });

  it('does not invoke session/load when the capability is absent', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id: request.id,
    result: { protocolVersion: 1, agentCapabilities: { sessionCapabilities: { list: {} } } }
  }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id: request.id,
    result: { sessions: [{ sessionId: 'session-no-load', cwd: '/tmp' }] }
  }) + '\\n');
} else if (request.method === 'session/load') {
  process.exit(13);
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      await client.listSessions();
      expect(client.isSessionLoadSupported()).toBe(false);
      await expect(client.loadSession('session-no-load')).rejects.toThrow(
        'does not support session loading',
      );
    } finally {
      await client.stop();
    }
  });

  it('starts a text-only prompt asynchronously after an authorized session load', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    protocolVersion: 1, agentCapabilities: { loadSession: true, sessionCapabilities: { list: {} } }
  } }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    sessions: [{ sessionId: 'session-prompt', cwd: '/tmp/project' }]
  } }) + '\\n');
} else if (request.method === 'session/load') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: null }) + '\\n');
} else if (request.method === 'session/prompt') {
  if (request.params.sessionId !== 'session-prompt' ||
      JSON.stringify(request.params.prompt) !== JSON.stringify([{ type: 'text', text: 'Continue.' }])) process.exit(18);
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: {
    sessionId: 'session-prompt', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Working.' } }
  } }) + '\\n');
  setTimeout(() => process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id: request.id, result: { stopReason: 'end_turn' }
  }) + '\\n'), 25);
}`);
    const client = new AcpSessionClient({
      executablePath,
      requestTimeoutMs: 1_000,
      promptTimeoutMs: 1_000,
    });
    try {
      await client.start();
      await client.listSessions();
      await client.loadSession('session-prompt');
      await expect(client.promptSession('session-prompt', 'Continue.')).resolves.toBeUndefined();
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(client.isSessionPromptSupported()).toBe(true);
      await expect(client.promptSession('session-prompt', 'Again.')).rejects.toThrow(
        'must be loaded before prompting',
      );
    } finally {
      await client.stop();
    }
  });

  it('exposes sanitized tool activity without exposing tool input or agent thoughts', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    protocolVersion: 1, agentCapabilities: { loadSession: true, sessionCapabilities: { list: {} } }
  } }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    sessions: [{ sessionId: 'session-activity', cwd: '/tmp/project' }]
  } }) + '\\n');
} else if (request.method === 'session/load') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: null }) + '\\n');
} else if (request.method === 'session/prompt') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: {
    sessionId: 'session-activity', update: {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'private reasoning must not leave the Mac' }
    }
  } }) + '\\n');
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: {
    sessionId: 'session-activity', update: {
      sessionUpdate: 'tool_call', toolCallId: 'call-1', kind: 'edit',
      title: 'Editing src/session.ts', rawInput: { token: 'private-token' }
    }
  } }) + '\\n');
  setTimeout(() => process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id: request.id, result: { stopReason: 'end_turn' }
  }) + '\\n'), 40);
}`);
    const client = new AcpSessionClient({
      executablePath,
      requestTimeoutMs: 1_000,
      promptTimeoutMs: 1_000,
    });

    try {
      await client.start();
      await client.listSessions();
      await client.loadSession('session-activity');
      await client.promptSession('session-activity', 'Make the change.');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const activity = await client.getSessionActivity('session-activity');
      expect(activity).toMatchObject({
        active: true,
        kind: 'editing',
        label: 'Editing src/session.ts',
      });
      expect(JSON.stringify(activity)).not.toMatch(/private-token|private reasoning|call-1/);
      let completedActivity = await client.getSessionActivity('session-activity');
      for (let attempt = 0; attempt < 20 && completedActivity?.active !== false; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        completedActivity = await client.getSessionActivity('session-activity');
      }
      expect(completedActivity).toMatchObject({
        active: false,
        label: 'Response ready',
      });
    } finally {
      await client.stop();
    }
  });

  it('applies an exact loaded-session model before prompting and rejects stale IDs', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    protocolVersion: 1, agentCapabilities: { loadSession: true, sessionCapabilities: { list: {} } }
  } }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    sessions: [{ sessionId: 'session-model', cwd: '/tmp/project' }]
  } }) + '\\n');
} else if (request.method === 'session/load') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    configOptions: [{
      id: 'model', name: 'Model', category: 'model', type: 'select',
      currentValue: 'swe-1.7-medium',
      options: [
        { value: 'swe-1.7-medium', name: 'SWE-1.7 Medium' },
        { value: 'swe-1.7-high', name: 'SWE-1.7 High' }
      ]
    }]
  } }) + '\\n');
} else if (request.method === 'session/set_config_option') {
  if (request.params.sessionId !== 'session-model' ||
      request.params.configId !== 'model' ||
      request.params.value !== 'swe-1.7-high') process.exit(31);
  globalThis.modelConfigured = true;
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    configOptions: [{
      id: 'model', name: 'Model', category: 'model', type: 'select',
      currentValue: 'swe-1.7-high',
      options: [
        { value: 'swe-1.7-medium', name: 'SWE-1.7 Medium' },
        { value: 'swe-1.7-high', name: 'SWE-1.7 High' }
      ]
    }]
  } }) + '\\n');
} else if (request.method === 'session/prompt') {
  if (!globalThis.modelConfigured || request.params.sessionId !== 'session-model') process.exit(32);
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    stopReason: 'end_turn'
  } }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      await client.listSessions();
      const loaded = await client.loadSession('session-model');
      expect(loaded.modelId).toBe('swe-1.7-medium');
      await expect(
        client.promptSession('session-model', 'Continue.', 'stale-model'),
      ).rejects.toThrow('model is not available');
      await expect(
        client.promptSession('session-model', 'Continue.', 'swe-1.7-high'),
      ).resolves.toBeUndefined();
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await client.stop();
    }
  });

  it('uses session close after a prompt when the agent advertises it', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    protocolVersion: 1,
    agentCapabilities: { loadSession: true, sessionCapabilities: { list: {}, close: {} } }
  } }) + '\\n');
} else if (request.method === 'session/list') {
  globalThis.listCount = (globalThis.listCount || 0) + 1;
  if (globalThis.listCount > 1 && !globalThis.closed) process.exit(28);
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    sessions: [{ sessionId: 'session-close', cwd: '/tmp/project' }]
  } }) + '\\n');
} else if (request.method === 'session/load') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: null }) + '\\n');
} else if (request.method === 'session/prompt') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    stopReason: 'end_turn'
  } }) + '\\n');
} else if (request.method === 'session/close') {
  if (request.params.sessionId !== 'session-close') process.exit(27);
  globalThis.closed = true;
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });
    try {
      await client.start();
      await client.listSessions();
      await client.loadSession('session-close');
      await client.promptSession('session-close', 'Continue.');
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(client.isSessionPromptSupported()).toBe(true);
      await expect(client.listSessions()).resolves.toEqual({
        sessions: [{ sessionId: 'session-close', cwd: '/tmp/project' }],
        nextCursor: undefined,
      });
    } finally {
      await client.stop();
    }
  });

  it('creates a new session with bounded embedded history before prompting it', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    protocolVersion: 1,
    agentCapabilities: { promptCapabilities: { embeddedContext: true } }
  } }) + '\\n');
} else if (request.method === 'session/new') {
  if (request.params.cwd !== '/tmp/project' ||
      JSON.stringify(request.params.mcpServers) !== '[]') process.exit(19);
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    sessionId: 'session-continuation'
  } }) + '\\n');
} else if (request.method === 'session/prompt') {
  const prompt = request.params.prompt;
  if (request.params.sessionId !== 'session-continuation' ||
      prompt.length !== 2 ||
      prompt[0].type !== 'resource' ||
      prompt[0].resource.uri !== 'devinx://continuation/history.md' ||
      prompt[0].resource.mimeType !== 'text/markdown' ||
      prompt[0].resource.text !== '# Prior history' ||
      JSON.stringify(prompt[1]) !== JSON.stringify({ type: 'text', text: 'Continue.' })) process.exit(20);
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    stopReason: 'end_turn'
  } }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      await expect(
        client.createContinuation('/tmp/project', '# Prior history', 'Continue.'),
      ).resolves.toBe('session-continuation');
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await client.stop();
    }
  });

  it('creates a local session, applies an offered model, then starts the prompt', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    protocolVersion: 1, agentCapabilities: {}
  } }) + '\\n');
} else if (request.method === 'session/new') {
  if (request.params.cwd !== '/tmp/project' ||
      JSON.stringify(request.params.mcpServers) !== '[]') process.exit(21);
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    sessionId: 'session-created',
    configOptions: [{
      id: 'model', name: 'Model', category: 'model', type: 'select',
      currentValue: 'adaptive',
      options: [
        { value: 'adaptive', name: 'Adaptive' },
        { value: 'gpt-5-6-sol-medium', name: 'GPT 5.6' }
      ]
    }]
  } }) + '\\n');
} else if (request.method === 'session/set_config_option') {
  if (request.params.sessionId !== 'session-created' ||
      request.params.configId !== 'model' ||
      request.params.value !== 'gpt-5-6-sol-medium') process.exit(22);
  globalThis.modelConfigured = true;
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    configOptions: [{
      id: 'model', name: 'Model', category: 'model', type: 'select',
      currentValue: 'gpt-5-6-sol-medium',
      options: [
        { value: 'adaptive', name: 'Adaptive' },
        { value: 'gpt-5-6-sol-medium', name: 'GPT 5.6' }
      ]
    }]
  } }) + '\\n');
} else if (request.method === 'session/prompt') {
  if (!globalThis.modelConfigured ||
      request.params.sessionId !== 'session-created' ||
      JSON.stringify(request.params.prompt) !== JSON.stringify([
        { type: 'text', text: 'Build it.' }
      ])) process.exit(23);
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    stopReason: 'end_turn'
  } }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      await expect(
        client.createSession('/tmp/project', 'gpt-5-6-sol-medium', 'Build it.'),
      ).resolves.toBe('session-created');
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await client.stop();
    }
  });

  it('sanitizes authoritative model metadata and ignores untrusted badge fields', () => {
    expect(
      parseAcpModelCatalog([
        {
          id: 'model',
          name: 'Model',
          category: 'model',
          type: 'select',
          currentValue: 'adaptive',
          options: [
            {
              value: 'adaptive',
              name: 'Adaptive',
              description: 'Balances quality and cost',
              _meta: {
                'cognition.ai/supportsImages': true,
                'cognition.ai/badge': 'new',
                privateToken: 'do-not-return',
              },
            },
            {
              value: 'deepseek-v4',
              name: 'DeepSeek V4 Pro',
              _meta: { 'cognition.ai/badge': 'guessed-promo' },
            },
          ],
        },
      ]),
    ).toEqual({
      defaultModelId: 'adaptive',
      models: [
        {
          id: 'adaptive',
          name: 'Adaptive',
          description: 'Balances quality and cost',
          supportsImages: true,
          badge: 'new',
        },
        { id: 'deepseek-v4', name: 'DeepSeek V4 Pro' },
      ],
    });
  });

  it('discovers and caches the full model catalog from a bounded existing-session load', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    protocolVersion: 1,
    agentCapabilities: { loadSession: true, sessionCapabilities: { list: {}, close: {} } }
  } }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    sessions: [
      { sessionId: 'session-locked', cwd: '/tmp/locked' },
      { sessionId: 'session-catalog', cwd: '/tmp/catalog' }
    ]
  } }) + '\\n');
} else if (request.method === 'session/load' && request.params.sessionId === 'session-locked') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: {
    code: -32600, message: 'Session is already open in another process'
  } }) + '\\n');
} else if (request.method === 'session/load') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    configOptions: [{
      id: 'model', name: 'Model', category: 'model', type: 'select',
      currentValue: 'adaptive',
      options: [
        { value: 'adaptive', name: 'Adaptive' },
        { value: 'deepseek-v4', name: 'DeepSeek V4 Pro' }
      ]
    }]
  } }) + '\\n');
} else if (request.method === 'session/close') {
  if (request.params.sessionId !== 'session-catalog') process.exit(29);
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }) + '\\n');
} else if (request.method === 'session/new' || request.method === 'session/prompt') {
  process.exit(25);
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });
    try {
      await client.start();
      const first = await client.listModelCatalog();
      const second = await client.listModelCatalog();
      expect(first).toEqual({
        defaultModelId: 'adaptive',
        models: [
          { id: 'adaptive', name: 'Adaptive' },
          { id: 'deepseek-v4', name: 'DeepSeek V4 Pro' },
        ],
      });
      expect(second).toEqual(first);
      expect(second).not.toBe(first);
    } finally {
      await client.stop();
    }
  });

  it('rejects duplicate or unavailable defaults in ACP model catalogs', () => {
    const base = {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: 'missing',
      options: [{ value: 'adaptive', name: 'Adaptive' }],
    };
    expect(() => parseAcpModelCatalog([base])).toThrow('default is unavailable');
    expect(() =>
      parseAcpModelCatalog([
        {
          ...base,
          currentValue: 'adaptive',
          options: [
            { value: 'adaptive', name: 'Adaptive' },
            { value: 'adaptive', name: 'Duplicate' },
          ],
        },
      ]),
    ).toThrow('duplicate IDs');
  });

  it('fails closed before prompting when a requested model is not offered', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    protocolVersion: 1, agentCapabilities: {}
  } }) + '\\n');
} else if (request.method === 'session/new') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    sessionId: 'session-created',
    configOptions: [{
      id: 'model', name: 'Model', category: 'model', type: 'select',
      currentValue: 'adaptive', options: [{ value: 'adaptive', name: 'Adaptive' }]
    }]
  } }) + '\\n');
} else if (request.method === 'session/prompt' ||
           request.method === 'session/set_config_option') {
  process.exit(24);
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      await expect(
        client.createSession('/tmp/project', 'gpt-5-6-sol-medium', 'Do not send.'),
      ).rejects.toThrow('model is not available');
    } finally {
      await client.stop();
    }
  });

  it('classifies an exclusively owned session without exposing its error text', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    protocolVersion: 1,
    agentCapabilities: { loadSession: true, sessionCapabilities: { list: {} } }
  } }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
    sessions: [{ sessionId: 'session-locked', cwd: '/tmp/project' }]
  } }) + '\\n');
} else if (request.method === 'session/load') {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: {
    code: -32600, message: "Session 'private-id' is already open in another process"
  } }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    try {
      await client.start();
      await client.listSessions();
      const error = await client.loadSession('session-locked').catch((failure: unknown) => failure);
      expect(isAcpSessionInUseError(error)).toBe(true);
      expect(String(error)).not.toContain('private-id');
    } finally {
      await client.stop();
    }
  });

  it('bounds replayed text history to the newest 200 messages', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id: request.id,
    result: { protocolVersion: 1, agentCapabilities: { loadSession: true, sessionCapabilities: { list: {} } } }
  }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id: request.id,
    result: { sessions: [{ sessionId: 'session-many', cwd: '/tmp/project' }] }
  }) + '\\n');
} else if (request.method === 'session/load') {
  for (let index = 0; index < 201; index += 1) {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0', method: 'session/update',
      params: {
        sessionId: 'session-many',
        update: {
          sessionUpdate: index % 2 === 0 ? 'user_message_chunk' : 'agent_message_chunk',
          messageId: 'message-' + index,
          content: { type: 'text', text: 'message-' + index }
        }
      }
    }) + '\\n');
  }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 2_000 });

    try {
      await client.start();
      await client.listSessions();
      const loaded = await client.loadSession('session-many');
      expect(loaded.messages).toHaveLength(200);
      expect(loaded.messages[0]?.text).toBe('message-1');
      expect(loaded.messages.at(-1)?.text).toBe('message-200');
      expect(loaded.truncated).toBe(true);
    } finally {
      await client.stop();
    }
  });

  it('drops differently-associated replay records without exposing or aborting history', async () => {
    const executablePath = fakeCli(`
if (request.method === 'initialize') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id: request.id,
    result: { protocolVersion: 1, agentCapabilities: { loadSession: true, sessionCapabilities: { list: {} } } }
  }) + '\\n');
} else if (request.method === 'session/list') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', id: request.id,
    result: { sessions: [{ sessionId: 'session-right', cwd: '/tmp/project' }] }
  }) + '\\n');
} else if (request.method === 'session/load') {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', method: 'session/update',
    params: {
      sessionId: 'session-wrong',
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'wrong' } }
    }
  }) + '\\n');
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0', method: 'session/update',
    params: {
      sessionId: 'session-right',
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'safe' } }
    }
  }) + '\\n');
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: null }) + '\\n');
}`);
    const client = new AcpSessionClient({ executablePath, requestTimeoutMs: 1_000 });

    await client.start();
    await client.listSessions();
    await expect(client.loadSession('session-right')).resolves.toMatchObject({
      messages: [{ source: 'devin', text: 'safe' }],
      truncated: true,
    });
    expect(client.isSessionLoadSupported()).toBe(true);
    await client.stop();
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
    ['relative workspace paths', [{ sessionId: 'session-relative', cwd: 'relative/path' }]],
    ['invalid metadata shapes', [{ sessionId: 'session-meta', cwd: '/tmp', _meta: 'invalid' }]],
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
