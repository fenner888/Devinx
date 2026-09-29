import { ActivityLog, type ActivityEntry } from '../../bridge/src/activity';
import type { AcpLoadedSession } from '../../bridge/src/acp';
import {
  RecoverableSessionDiscoveryAdapter,
  type SessionHistoryLifecycle,
} from '../../bridge/src/runner';
import type { SessionDiscoveryAdapter } from '../../bridge/src/service';

const SESSION_ID = 'message-time-session';
const TOOL_CALL_ID = 'call-message-time-session';

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
  const loaded: AcpLoadedSession = {
    sessionId,
    cwd: '/workspace',
    messages: [{ source: 'devin', text: 'The command was rejected.' }],
    truncated: false,
  };
  Object.defineProperty(loaded, 'activity', {
    value: [failedActivity()],
    enumerable: false,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(loaded, 'messageTimes', {
    value: [1_700_000_000_000],
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return loaded;
}

describe('runner message timestamp preservation', () => {
  it('preserves non-enumerable message times when marking timed-out activity', async () => {
    const adapter: SessionDiscoveryAdapter = {
      isSessionListSupported: () => true,
      listSessions: async () => ({ sessions: [{ sessionId: SESSION_ID, cwd: '/workspace' }] }),
      isSessionLoadSupported: () => true,
      loadSession: async (sessionId) => loadedSession(sessionId),
      getTimedOutToolCallIds: () => new Set([TOOL_CALL_ID]),
      isSessionPromptSupported: () => false,
      promptSession: async () => undefined,
    };
    const history: SessionHistoryLifecycle = {
      start: async () => undefined,
      stop: async () => undefined,
      isSessionLoadSupported: () => true,
      loadSession: async (sessionId) => loadedSession(sessionId),
    };
    const runner = new RecoverableSessionDiscoveryAdapter();
    runner.replace(adapter);
    runner.setHistory(history);
    await runner.listSessions();

    const loaded = await runner.loadSession(SESSION_ID);

    expect(loaded.activity?.[0]?.status).toBe('timed_out');
    expect(loaded.messageTimes).toEqual([1_700_000_000_000]);
    expect(Object.prototype.propertyIsEnumerable.call(loaded, 'messageTimes')).toBe(false);
  });
});
