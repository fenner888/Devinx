import {
  ActivityLog,
  type ActivityEntry,
} from '../../bridge/src/activity';
import type { AcpLoadedSession, AcpSessionTurn } from '../../bridge/src/acp';
import {
  RecoverableSessionDiscoveryAdapter,
  type SessionHistoryLifecycle,
} from '../../bridge/src/runner';
import type { SessionDiscoveryAdapter } from '../../bridge/src/service';

const SESSION_ID = 'timeout-session';
const TOOL_CALL_ID = 'call-timeout-session';

function failedActivity(): ActivityEntry {
  const log = new ActivityLog();
  log.beginTool(
    0,
    { toolCallId: TOOL_CALL_ID, title: 'Run a command', kind: 'execute', status: 'pending' },
    '/workspace',
    100,
  );
  const entry = log.entryForToolCall(TOOL_CALL_ID);
  if (!entry) throw new Error('Expected an activity entry');
  return { ...entry, status: 'failed' };
}

function loadedSession(sessionId: string): AcpLoadedSession {
  const session: AcpLoadedSession = {
    sessionId,
    cwd: '/workspace',
    messages: [{ source: 'devin', text: 'The command was rejected.' }],
    truncated: false,
  };
  Object.defineProperty(session, 'activity', {
    value: [failedActivity()],
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return session;
}

function currentAdapter(
  loadSession: (sessionId: string) => Promise<AcpLoadedSession>,
  turn?: AcpSessionTurn,
): SessionDiscoveryAdapter {
  return {
    isSessionListSupported: () => true,
    listSessions: async () => ({ sessions: [{ sessionId: SESSION_ID, cwd: '/workspace' }] }),
    isSessionLoadSupported: () => true,
    loadSession,
    getTimedOutToolCallIds: (sessionId) =>
      sessionId === SESSION_ID ? new Set([TOOL_CALL_ID]) : new Set(),
    ...(turn ? { getSessionTurn: () => turn } : {}),
    isSessionPromptSupported: () => true,
    promptSession: async () => {},
  };
}

describe('runner timed-out activity recovery', () => {
  it('marks failed history-store activity as timed out while preserving its non-enumerable field', async () => {
    const runner = new RecoverableSessionDiscoveryAdapter();
    runner.replace(currentAdapter(async () => loadedSession(SESSION_ID)));
    const history: SessionHistoryLifecycle = {
      start: async () => {},
      stop: async () => {},
      isSessionLoadSupported: () => true,
      loadSession: async (sessionId) => loadedSession(sessionId),
    };
    runner.setHistory(history);

    await runner.listSessions();
    const loaded = await runner.loadSession(SESSION_ID);

    expect(loaded.activity?.[0]?.status).toBe('timed_out');
    expect(Object.prototype.propertyIsEnumerable.call(loaded, 'activity')).toBe(false);
  });

  it('marks failed ACP-load activity as timed out', async () => {
    const runner = new RecoverableSessionDiscoveryAdapter();
    runner.replace(currentAdapter(async (sessionId) => loadedSession(sessionId)));

    await runner.listSessions();
    const loaded = await runner.loadSession(SESSION_ID);

    expect(loaded.activity?.[0]?.status).toBe('timed_out');
  });

  it('applies remembered timeout marks to returned turn activity', async () => {
    const turn: AcpSessionTurn = {
      startedAt: 100,
      reply: 'The command was rejected.',
      replyTruncated: false,
      activity: [failedActivity()],
    };
    const runner = new RecoverableSessionDiscoveryAdapter();
    runner.replace(currentAdapter(async (sessionId) => loadedSession(sessionId), turn));

    await expect(runner.getSessionTurn(SESSION_ID)).resolves.toMatchObject({
      activity: [{ status: 'timed_out' }],
    });
  });
});
