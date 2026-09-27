import {
  ActivityLog,
  activityKindFromToolName,
  activityStatusFromAcp,
  relativeActivityPath,
} from '../../bridge/src/activity';

const CWD = '/Users/tester/ws';

function toolCall(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    toolCallId: 'call_one',
    title: 'Read file',
    kind: 'read',
    status: 'pending',
    ...overrides,
  };
}

describe('activityStatusFromAcp', () => {
  it.each([
    ['pending', 'running'],
    ['in_progress', 'running'],
    ['completed', 'completed'],
    ['failed', 'failed'],
    ['cancelled', 'unknown'],
    [undefined, 'unknown'],
    ['bogus', 'unknown'],
  ] as const)('maps %s to %s', (input, expected) => {
    expect(activityStatusFromAcp(input)).toBe(expected);
  });
});

describe('activityKindFromToolName', () => {
  it.each([
    ['read', 'read'],
    ['view', 'read'],
    ['edit', 'edit'],
    ['write', 'edit'],
    ['multi_edit', 'edit'],
    ['delete', 'delete'],
    ['move', 'move'],
    ['rename', 'move'],
    ['grep', 'search'],
    ['glob', 'search'],
    ['find', 'search'],
    ['exec', 'execute'],
    ['bash', 'execute'],
    ['get_output', 'execute'],
    ['kill_shell', 'execute'],
    ['think', 'think'],
    ['webfetch', 'fetch'],
    ['web_search', 'fetch'],
    ['mystery', 'other'],
  ] as const)('maps %s to %s', (input, expected) => {
    expect(activityKindFromToolName(input)).toBe(expected);
  });
});

describe('relativeActivityPath', () => {
  it('relativizes paths inside the workspace', () => {
    expect(relativeActivityPath('/Users/tester/ws/notes.txt', CWD)).toBe('notes.txt');
    expect(relativeActivityPath('/Users/tester/ws/src/app.ts', CWD)).toBe('src/app.ts');
    expect(relativeActivityPath('.', CWD)).toBe('.');
  });

  it('keeps only the basename for paths outside the workspace', () => {
    expect(relativeActivityPath('/Users/tester/other/secret.txt', CWD)).toBe('secret.txt');
    expect(relativeActivityPath('/etc/passwd', CWD)).toBe('passwd');
  });

  it('never returns an absolute path or $HOME prefix', () => {
    for (const candidate of [
      '/Users/tester/ws/notes.txt',
      '~/ws/notes.txt',
      '/outside/thing.ts',
      '../escape.ts',
      '/Users/tester/ws/../outside.ts',
    ]) {
      const result = relativeActivityPath(candidate, CWD);
      expect(result.startsWith('/')).toBe(false);
      expect(result.startsWith('~')).toBe(false);
      expect(result.split('/')).not.toContain('..');
    }
  });
});

describe('ActivityLog', () => {
  it('merges consecutive thought chunks into one open entry', () => {
    const log = new ActivityLog();
    log.beginThought(0, 'Planning ');
    log.beginThought(0, 'the steps.');
    const entries = log.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'thought',
      status: 'running',
      detail: { type: 'text', text: 'Planning the steps.' },
    });
  });

  it('closes a thought when a tool call follows it', () => {
    const log = new ActivityLog();
    log.beginThought(1, 'Thinking.');
    log.beginTool(1, toolCall(), CWD);
    const entries = log.list();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.status).toBe('completed');
    expect(entries[1]?.kind).toBe('tool');
  });

  it('keeps the inferred tool kind, title, and relative paths', () => {
    const log = new ActivityLog();
    log.beginTool(
      2,
      toolCall({
        title: 'Read file',
        kind: 'read',
        locations: [{ path: '/Users/tester/ws/notes.txt' }],
        _meta: { 'cognition.ai/inferenceToolName': 'read' },
      }),
      CWD,
    );
    const [entry] = log.list();
    expect(entry).toMatchObject({
      kind: 'tool',
      toolKind: 'read',
      title: 'Read file',
      status: 'running',
      paths: ['notes.txt'],
    });
  });

  it('derives the tool kind from the inference name when kind is absent', () => {
    const log = new ActivityLog();
    log.beginTool(
      0,
      toolCall({
        toolCallId: 'call_grep',
        title: "Search for 'x'",
        kind: undefined,
        _meta: { 'cognition.ai/inferenceToolName': 'grep' },
      }),
      CWD,
    );
    expect(log.list()[0]?.toolKind).toBe('search');
  });

  it('prefers diff content for detail and includes the diff path in paths', () => {
    const log = new ActivityLog();
    log.beginTool(
      0,
      toolCall({
        toolCallId: 'call_edit',
        title: 'Edit file',
        kind: 'edit',
        content: [
          {
            type: 'diff',
            path: '/Users/tester/ws/notes.txt',
            oldText: 'old\n',
            newText: 'new\n',
          },
          { type: 'content', content: { type: 'text', text: 'ignored text' } },
        ],
        locations: [{ path: '/Users/tester/ws/notes.txt' }],
      }),
      CWD,
    );
    const [entry] = log.list();
    expect(entry?.detail).toEqual({
      type: 'diff',
      path: 'notes.txt',
      oldText: 'old\n',
      newText: 'new\n',
    });
    expect(entry?.paths).toEqual(['notes.txt']);
  });

  it('uses the shell preview as a "$ command" line and appends output plus exit code', () => {
    const log = new ActivityLog();
    log.beginTool(
      0,
      toolCall({
        toolCallId: 'call_exec',
        title: 'Ran sleep',
        kind: 'execute',
        content: [
          {
            type: 'content',
            content: {
              type: 'resource',
              resource: { mimeType: 'text/x-shellscript', text: 'sleep 25 && wc -l notes.txt' },
            },
          },
        ],
      }),
      CWD,
    );
    log.updateTool('call_exec', {
      status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: '       2 notes.txt' } }],
      _meta: { terminal_exit: { exit_code: 0, signal: null } },
    });
    const [entry] = log.list();
    expect(entry?.status).toBe('completed');
    expect(entry?.endedAt).toBeDefined();
    expect(entry?.detail).toMatchObject({
      type: 'text',
    });
    const text = (entry?.detail as { text: string }).text;
    expect(text.startsWith('$ sleep 25 && wc -l notes.txt')).toBe(true);
    expect(text).toContain('       2 notes.txt');
    expect(text).toContain('Exit code: 0');
  });

  it('keeps diff detail when an update carries text', () => {
    const log = new ActivityLog();
    log.beginTool(
      0,
      toolCall({
        toolCallId: 'call_edit',
        kind: 'edit',
        content: [{ type: 'diff', path: '/Users/tester/ws/a.txt', newText: 'x' }],
      }),
      CWD,
    );
    log.updateTool('call_edit', {
      status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: 'post-output' } }],
    });
    expect(log.list()[0]?.detail?.type).toBe('diff');
  });

  it('clips text detail to a UTF-8 tail without splitting multi-byte characters', () => {
    const log = new ActivityLog();
    const glyph = '€'.repeat(20_000); // 3 bytes each
    log.beginThought(0, `prefix ${glyph}`);
    const [entry] = log.list();
    expect(entry?.truncated).toBe(true);
    const text = (entry?.detail as { text: string }).text;
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(16 * 1024);
    expect(text).not.toContain('�');
    expect(text.endsWith('€')).toBe(true);
  });

  it('drops the oldest entries past the 500-entry cap and marks the log truncated', () => {
    const log = new ActivityLog();
    for (let index = 0; index < 505; index += 1) {
      log.beginTool(0, toolCall({ toolCallId: `call_${index}`, title: `Tool ${index}` }), CWD);
    }
    const entries = log.list();
    expect(entries).toHaveLength(500);
    expect(log.truncated).toBe(true);
    expect(entries[0]?.title).toBe('Tool 5');
  });

  it('drops detail of the oldest entries when the total detail budget is exceeded', () => {
    const log = new ActivityLog();
    const chunk = 'x'.repeat(60 * 1024);
    for (let index = 0; index < 40; index += 1) {
      log.beginTool(
        0,
        toolCall({
          toolCallId: `big_${index}`,
          content: [{ type: 'content', content: { type: 'text', text: `${index}:${chunk}` } }],
        }),
        CWD,
      );
    }
    const entries = log.list();
    expect(entries).toHaveLength(40);
    const withDetail = entries.filter((entry) => entry.detail !== undefined);
    const total = withDetail.reduce(
      (sum, entry) => sum + Buffer.byteLength((entry.detail as { text: string }).text, 'utf8'),
      0,
    );
    expect(total).toBeLessThanOrEqual(160 * 1024);
    expect(withDetail.length).toBeLessThan(40);
    expect(log.truncated).toBe(true);
  });

  it('marks still-running tools interrupted on finishTurn', () => {
    const log = new ActivityLog();
    log.beginTool(0, toolCall({ toolCallId: 'call_open' }), CWD);
    log.beginTool(0, toolCall({ toolCallId: 'call_done' }), CWD);
    log.updateTool('call_done', { status: 'completed' });
    log.finishTurn(1_000);
    const [open, done] = log.list();
    expect(open).toMatchObject({ status: 'interrupted', endedAt: 1_000 });
    expect(done).toMatchObject({ status: 'completed' });
  });

  it('fails closed on invalid input instead of throwing', () => {
    const log = new ActivityLog();
    expect(() => {
      log.beginTool(0, { toolCallId: 42 }, CWD);
      log.beginThought(0, 12_345 as unknown as string);
      log.updateTool('call_missing', { status: 'completed' });
    }).not.toThrow();
    expect(log.truncated).toBe(true);
    expect(log.list()).toEqual([]);
  });

  it('sanitizes titles and control characters', () => {
    const log = new ActivityLog();
    log.beginTool(0, toolCall({ title: 'Read\n\nfile\tnow  ' }), CWD);
    expect(log.list()[0]?.title).toBe('Read file now');
  });

  it('leaves timestamps unset without wall-clock fallback when implicitTimestamps is off', () => {
    const log = new ActivityLog({ implicitTimestamps: false });
    log.beginTool(0, toolCall({ toolCallId: 'call_a', title: 'A' }), CWD);
    log.updateTool('call_a', { status: 'completed' });
    log.beginTool(0, toolCall({ toolCallId: 'call_b', title: 'B' }), CWD);
    log.interruptTool('call_b');
    log.beginThought(0, 'musing');
    log.finishTurn();
    const [a, b, thought] = log.list();
    expect(a).toMatchObject({ status: 'completed' });
    expect(a?.startedAt).toBeUndefined();
    expect(a?.endedAt).toBeUndefined();
    expect(b).toMatchObject({ status: 'interrupted' });
    expect(b?.endedAt).toBeUndefined();
    expect(thought?.status).toBe('completed');
    expect(thought?.endedAt).toBeUndefined();
  });

  it('still applies explicit timestamps when implicitTimestamps is off', () => {
    const log = new ActivityLog({ implicitTimestamps: false });
    log.beginTool(0, toolCall({ toolCallId: 'call_ts' }), CWD, 500);
    log.updateTool('call_ts', { status: 'failed' }, 900);
    const [entry] = log.list();
    expect(entry).toMatchObject({ status: 'failed', startedAt: 500, endedAt: 900 });
  });
});
