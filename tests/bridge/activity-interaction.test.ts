import {
  ActivityLog,
  activityEntrySchema,
  legacyActivityStatus,
} from '../../bridge/src/activity';

describe('local interaction activity states', () => {
  function activityFor(toolCallId: string) {
    const log = new ActivityLog();
    log.beginTool(
      0,
      { toolCallId, title: 'Run command', kind: 'execute', status: 'pending' },
      '/workspace',
      100,
    );
    return log;
  }

  it('marks, resumes, and interrupts tools awaiting input', () => {
    const log = activityFor('call-question');
    log.markAwaitingInput('call-question');
    expect(log.entryForToolCall('call-question')).toMatchObject({ status: 'awaiting_input' });

    log.resumeTool('call-question');
    expect(log.entryForToolCall('call-question')).toMatchObject({ status: 'running' });
    log.markAwaitingInput('call-question');
    log.finishTurn(200);
    expect(log.entryForToolCall('call-question')).toMatchObject({
      status: 'interrupted',
      endedAt: 200,
    });
  });

  it('times out a tool and keeps the timeout sticky against later updates', () => {
    const log = activityFor('call-timeout');
    log.markAwaitingInput('call-timeout');
    log.timeOutTool('call-timeout', 300);
    log.updateTool('call-timeout', { status: 'failed', rawOutput: 'late result' }, 400);

    expect(log.entryForToolCall('call-timeout')).toMatchObject({
      status: 'timed_out',
      endedAt: 300,
    });
  });

  it('returns copies of tool entries and maps only new statuses for legacy clients', () => {
    const log = new ActivityLog();
    log.beginTool(
      0,
      {
        toolCallId: 'call-copy',
        title: 'Read file',
        kind: 'read',
        locations: [{ path: '/workspace/notes.txt' }],
      },
      '/workspace',
    );
    const entry = log.entryForToolCall('call-copy');
    entry?.paths?.push('mutated');
    expect(log.entryForToolCall('call-copy')?.paths).toEqual(['notes.txt']);

    expect(legacyActivityStatus('awaiting_input')).toBe('running');
    expect(legacyActivityStatus('timed_out')).toBe('failed');
    expect(legacyActivityStatus('completed')).toBe('completed');
    expect(
      activityEntrySchema.safeParse({
        id: 'tool_timeout',
        afterSequence: 0,
        kind: 'tool',
        status: 'timed_out',
        title: 'Run command',
        truncated: false,
        endedAt: 300,
      }).success,
    ).toBe(true);
  });
});
