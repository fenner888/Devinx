const mockGetComputerBridgeHealth = jest.fn();
const mockListComputerSessions = jest.fn();
const mockLoadComputerSession = jest.fn();
let mockOpenComputerBridgesError: unknown;

jest.mock('../../src/auth/computerBridge', () => {
  class MockComputerBridgeError extends Error {
    readonly code: string;

    constructor(mockMessage: string, mockErrorCode: string) {
      super(mockMessage);
      this.code = mockErrorCode;
    }
  }
  return {
    ComputerBridgeError: MockComputerBridgeError,
    openComputerBridges: async (bridgeIds: string[]) => {
      if (mockOpenComputerBridgesError !== undefined) throw mockOpenComputerBridgesError;
      return new Map(
        bridgeIds.map((bridgeId) => [
          bridgeId,
          {
            bridgeId,
            getHealth: () => mockGetComputerBridgeHealth(bridgeId),
            listSessions: (input: unknown) => mockListComputerSessions(bridgeId, input),
            loadSession: (sessionId: string) => mockLoadComputerSession(bridgeId, sessionId),
          },
        ]),
      );
    },
  };
});

jest.mock('../../src/auth/ConnectionContext', () => ({
  useConnections: () => ({ mode: 'computer', computers: [] }),
}));

import { ComputerBridgeError } from '../../src/auth/computerBridge';
import type { PairedComputerSummary } from '../../src/auth/pairedComputers';
import {
  loadComputerSessionBoard,
  loadComputerSessionWithRecovery,
} from '../../src/api/bridge/queries';

const FIRST: PairedComputerSummary = {
  bridgeId: 'bridge_1234567890',
  computerName: 'Studio Mac',
  pairedAt: 1_800_000_000_000,
  permissions: ['bridge:health', 'session:metadata:read'],
  transportKind: 'local_network',
};
const SECOND: PairedComputerSummary = {
  bridgeId: 'bridge_0987654321',
  computerName: 'Travel Mac',
  pairedAt: 1_800_000_000_001,
  permissions: ['bridge:health', 'session:metadata:read'],
  transportKind: 'tailscale_vpn',
};

function session(idCharacter: string, updatedAt: string) {
  return {
    id: `local_${idCharacter.repeat(43)}`,
    origin: 'computer',
    workspaceName: `Workspace ${idCharacter}`,
    hasTitle: false,
    updatedAt,
  } as const;
}

describe('Computer session board query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenComputerBridgesError = undefined;
    mockGetComputerBridgeHealth.mockResolvedValue({
      protocolVersion: 2,
      status: 'ready',
      capabilities: {
        sessionList: true,
        sessionLoad: false,
        sessionPrompt: false,
      },
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns no freshness timestamp when there are no computers', async () => {
    await expect(loadComputerSessionBoard([])).resolves.toEqual({
      sessions: [],
      computers: [],
    });
  });

  it('checks health, follows bounded cursors, labels origin, and sorts across Macs', async () => {
    const lastSuccessfulAt = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(lastSuccessfulAt);
    mockListComputerSessions.mockImplementation(
      async (bridgeId: string, input: { cursor?: string }) => {
        if (bridgeId === FIRST.bridgeId && !input.cursor) {
          return {
            sessions: [session('A', '2027-01-15T10:00:00.000Z')],
            nextCursor: 'page-two',
          };
        }
        if (bridgeId === FIRST.bridgeId && input.cursor === 'page-two') {
          return { sessions: [session('B', '2027-01-15T12:00:00.000Z')] };
        }
        return { sessions: [session('C', '2027-01-15T11:00:00.000Z')] };
      },
    );

    const result = await loadComputerSessionBoard([FIRST, SECOND]);

    expect(mockGetComputerBridgeHealth).toHaveBeenCalledTimes(2);
    expect(mockListComputerSessions).toHaveBeenCalledWith(FIRST.bridgeId, {});
    expect(mockListComputerSessions).toHaveBeenCalledWith(FIRST.bridgeId, {
      cursor: 'page-two',
    });
    expect(result.sessions.map((item) => item.workspaceName)).toEqual([
      'Workspace B',
      'Workspace C',
      'Workspace A',
    ]);
    expect(result.sessions[0]).toMatchObject({
      bridgeId: FIRST.bridgeId,
      computerName: FIRST.computerName,
      origin: 'computer',
      canLoad: false,
    });
    expect(result.computers).toEqual([
      { bridgeId: FIRST.bridgeId, computerName: FIRST.computerName, state: 'ready' },
      { bridgeId: SECOND.bridgeId, computerName: SECOND.computerName, state: 'ready' },
    ]);
    expect(result.lastSuccessfulAt).toBe(lastSuccessfulAt);
  });

  it('uses the authenticated Mac capability instead of a stale cached grant', async () => {
    mockGetComputerBridgeHealth.mockResolvedValue({
      protocolVersion: 2,
      status: 'ready',
      capabilities: {
        sessionList: true,
        sessionLoad: true,
        sessionPrompt: false,
      },
    });
    mockListComputerSessions.mockResolvedValue({
      sessions: [session('A', '2027-01-15T10:00:00.000Z')],
    });
    const granted: PairedComputerSummary = {
      ...FIRST,
      permissions: [...FIRST.permissions, 'session:content:read'],
    };

    await expect(loadComputerSessionBoard([granted])).resolves.toMatchObject({
      sessions: [{ canLoad: true }],
    });
    await expect(loadComputerSessionBoard([FIRST])).resolves.toMatchObject({
      sessions: [{ canLoad: true }],
    });
  });

  it('reports pairing-only bridges without requesting a session list', async () => {
    const lastSuccessfulAt = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(lastSuccessfulAt);
    mockGetComputerBridgeHealth.mockResolvedValue({
      protocolVersion: 2,
      status: 'ready',
      capabilities: {
        sessionList: false,
        sessionLoad: false,
        sessionPrompt: false,
      },
    });

    await expect(loadComputerSessionBoard([FIRST])).resolves.toEqual({
      sessions: [],
      computers: [
        {
          bridgeId: FIRST.bridgeId,
          computerName: FIRST.computerName,
          state: 'session_discovery_off',
        },
      ],
      lastSuccessfulAt,
    });
    expect(mockListComputerSessions).not.toHaveBeenCalled();
  });

  it('keeps healthy Mac results when another Mac is offline', async () => {
    mockGetComputerBridgeHealth.mockImplementation(async (bridgeId: string) => {
      if (bridgeId === SECOND.bridgeId) {
        throw new ComputerBridgeError('private transport detail', 'unavailable');
      }
      return {
        protocolVersion: 2,
        status: 'ready',
        capabilities: {
          sessionList: true,
          sessionLoad: false,
          sessionPrompt: false,
        },
      };
    });
    mockListComputerSessions.mockResolvedValue({
      sessions: [session('A', '2027-01-15T10:00:00.000Z')],
    });

    const result = await loadComputerSessionBoard([FIRST, SECOND]);

    expect(result.sessions).toHaveLength(1);
    expect(result.computers).toContainEqual({
      bridgeId: SECOND.bridgeId,
      computerName: SECOND.computerName,
      state: 'unavailable',
    });
  });

  it('retains the last verified sessions during a transient bridge outage', async () => {
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    mockListComputerSessions.mockResolvedValue({
      sessions: [session('A', '2027-01-15T10:00:00.000Z')],
    });
    const previous = await loadComputerSessionBoard([FIRST]);
    dateNow.mockReturnValue(1_800_000_000_001);
    mockGetComputerBridgeHealth.mockRejectedValueOnce(
      new ComputerBridgeError('private transport detail', 'unavailable'),
    );

    const result = await loadComputerSessionBoard([FIRST], previous);

    expect(result.sessions).toEqual(previous.sessions);
    expect(result.computers).toEqual([
      { bridgeId: FIRST.bridgeId, computerName: FIRST.computerName, state: 'unavailable' },
    ]);
    expect(result.lastSuccessfulAt).toBe(previous.lastSuccessfulAt);
  });

  it('preserves the previous timestamp when opening computer bridges fails', async () => {
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    mockListComputerSessions.mockResolvedValue({
      sessions: [session('A', '2027-01-15T10:00:00.000Z')],
    });
    const previous = await loadComputerSessionBoard([FIRST]);
    dateNow.mockReturnValue(1_800_000_000_001);
    mockOpenComputerBridgesError = new ComputerBridgeError('private transport detail', 'busy');

    const result = await loadComputerSessionBoard([FIRST], previous);

    expect(result.sessions).toEqual([]);
    expect(result.computers).toEqual([
      { bridgeId: FIRST.bridgeId, computerName: FIRST.computerName, state: 'busy' },
    ]);
    expect(result.lastSuccessfulAt).toBe(previous.lastSuccessfulAt);
  });

  it.each(['rate_limited', 'busy'] as const)(
    'retains the last verified sessions when discovery is %s',
    async (code) => {
      const dateNow = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
      mockListComputerSessions.mockResolvedValue({
        sessions: [session('A', '2027-01-15T10:00:00.000Z')],
      });
      const previous = await loadComputerSessionBoard([FIRST]);
      dateNow.mockReturnValue(1_800_000_000_001);
      mockListComputerSessions.mockRejectedValueOnce(
        new ComputerBridgeError('private transport detail', code),
      );

      const result = await loadComputerSessionBoard([FIRST], previous);

      expect(result.sessions).toEqual(previous.sessions);
      expect(result.computers).toEqual([
        { bridgeId: FIRST.bridgeId, computerName: FIRST.computerName, state: 'busy' },
      ]);
      expect(result.lastSuccessfulAt).toBe(previous.lastSuccessfulAt);
    },
  );

  it('leaves freshness undefined when busy discovery has no previous board', async () => {
    mockListComputerSessions.mockRejectedValueOnce(
      new ComputerBridgeError('private transport detail', 'busy'),
    );

    const result = await loadComputerSessionBoard([FIRST]);

    expect(result.computers).toEqual([
      { bridgeId: FIRST.bridgeId, computerName: FIRST.computerName, state: 'busy' },
    ]);
    expect(result.sessions).toEqual([]);
    expect(result.lastSuccessfulAt).toBeUndefined();
  });

  it('fails closed when the fifth page has a continuation cursor', async () => {
    const previous = {
      sessions: [
        {
          ...session('Z', '2027-01-15T09:00:00.000Z'),
          bridgeId: FIRST.bridgeId,
          computerName: FIRST.computerName,
          canLoad: false,
        },
      ],
      computers: [
        { bridgeId: FIRST.bridgeId, computerName: FIRST.computerName, state: 'ready' as const },
      ],
      lastSuccessfulAt: 1_800_000_000_000,
    };
    let pageNumber = 0;
    mockListComputerSessions.mockImplementation(async () => {
      pageNumber += 1;
      return {
        sessions: [session(String.fromCharCode(64 + pageNumber), '2027-01-15T10:00:00.000Z')],
        nextCursor: `page-${pageNumber}`,
      };
    });

    const result = await loadComputerSessionBoard([FIRST], previous);

    expect(mockListComputerSessions).toHaveBeenCalledTimes(5);
    expect(result.sessions).toEqual([]);
    expect(result.computers).toEqual([
      { bridgeId: FIRST.bridgeId, computerName: FIRST.computerName, state: 'too_many_sessions' },
    ]);
    expect(result.lastSuccessfulAt).toBe(previous.lastSuccessfulAt);
  });

  it('rehydrates a restarted Connector handle through one authenticated list before retrying load', async () => {
    const listedSession = session('A', '2027-01-15T10:00:00.000Z');
    const loadedSession = {
      session: listedSession,
      messages: [{ sequence: 1, source: 'devin', text: 'Recovered.' }],
      truncated: false,
    };
    mockGetComputerBridgeHealth.mockResolvedValue({
      protocolVersion: 2,
      status: 'ready',
      capabilities: {
        sessionList: true,
        sessionLoad: true,
        sessionPrompt: false,
      },
    });
    mockListComputerSessions.mockResolvedValue({ sessions: [listedSession] });
    mockLoadComputerSession
      .mockRejectedValueOnce(
        new ComputerBridgeError('public authorization failure', 'authorization_failed'),
      )
      .mockResolvedValueOnce(loadedSession);

    await expect(loadComputerSessionWithRecovery(FIRST, listedSession.id)).resolves.toEqual(
      loadedSession,
    );
    expect(mockGetComputerBridgeHealth).toHaveBeenCalledTimes(1);
    expect(mockListComputerSessions).toHaveBeenCalledTimes(1);
    expect(mockLoadComputerSession).toHaveBeenCalledTimes(2);
  });

  it('does not retry a stale handle that the authenticated Connector cannot rediscover', async () => {
    const staleSessionId = session('A', '2027-01-15T10:00:00.000Z').id;
    mockGetComputerBridgeHealth.mockResolvedValue({
      protocolVersion: 2,
      status: 'ready',
      capabilities: {
        sessionList: true,
        sessionLoad: true,
        sessionPrompt: false,
      },
    });
    mockListComputerSessions.mockResolvedValue({
      sessions: [session('B', '2027-01-15T11:00:00.000Z')],
    });
    mockLoadComputerSession.mockRejectedValueOnce(
      new ComputerBridgeError('public authorization failure', 'authorization_failed'),
    );

    await expect(loadComputerSessionWithRecovery(FIRST, staleSessionId)).rejects.toMatchObject({
      code: 'authorization_failed',
    });
    expect(mockLoadComputerSession).toHaveBeenCalledTimes(1);
  });

  it('fails a computer closed on repeated cursors or duplicate session handles', async () => {
    mockListComputerSessions.mockResolvedValue({
      sessions: [session('A', '2027-01-15T10:00:00.000Z')],
      nextCursor: 'repeat',
    });

    const previous = {
      sessions: [
        {
          ...session('B', '2027-01-15T09:00:00.000Z'),
          bridgeId: FIRST.bridgeId,
          computerName: FIRST.computerName,
          canLoad: false,
        },
      ],
      computers: [
        { bridgeId: FIRST.bridgeId, computerName: FIRST.computerName, state: 'ready' as const },
      ],
    };
    const result = await loadComputerSessionBoard([FIRST], previous);

    expect(result.sessions).toEqual([]);
    expect(result.computers[0]).toMatchObject({ state: 'invalid_response' });
    expect(mockListComputerSessions).toHaveBeenCalledTimes(2);
  });
});
