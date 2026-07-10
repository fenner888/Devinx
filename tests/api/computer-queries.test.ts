const mockGetComputerBridgeHealth = jest.fn();
const mockListComputerSessions = jest.fn();

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
    openComputerBridges: async (bridgeIds: string[]) =>
      new Map(
        bridgeIds.map((bridgeId) => [
          bridgeId,
          {
            bridgeId,
            getHealth: () => mockGetComputerBridgeHealth(bridgeId),
            listSessions: (input: unknown) => mockListComputerSessions(bridgeId, input),
          },
        ]),
      ),
  };
});

jest.mock('../../src/auth/ConnectionContext', () => ({
  useConnections: () => ({ mode: 'computer', computers: [] }),
}));

import { ComputerBridgeError } from '../../src/auth/computerBridge';
import type { PairedComputerSummary } from '../../src/auth/pairedComputers';
import { loadComputerSessionBoard } from '../../src/api/bridge/queries';

const FIRST: PairedComputerSummary = {
  bridgeId: 'bridge_1234567890',
  computerName: 'Studio Mac',
  pairedAt: 1_800_000_000_000,
  permissions: ['bridge:health', 'session:metadata:read'],
};
const SECOND: PairedComputerSummary = {
  bridgeId: 'bridge_0987654321',
  computerName: 'Travel Mac',
  pairedAt: 1_800_000_000_001,
  permissions: ['bridge:health', 'session:metadata:read'],
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
    mockGetComputerBridgeHealth.mockResolvedValue({
      protocolVersion: 1,
      status: 'ready',
      capabilities: { sessionList: true, sessionLoad: false, sessionPrompt: false },
    });
  });

  it('checks health, follows bounded cursors, labels origin, and sorts across Macs', async () => {
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
    });
    expect(result.computers).toEqual([
      { bridgeId: FIRST.bridgeId, computerName: FIRST.computerName, state: 'ready' },
      { bridgeId: SECOND.bridgeId, computerName: SECOND.computerName, state: 'ready' },
    ]);
  });

  it('reports pairing-only bridges without requesting a session list', async () => {
    mockGetComputerBridgeHealth.mockResolvedValue({
      protocolVersion: 1,
      status: 'ready',
      capabilities: { sessionList: false, sessionLoad: false, sessionPrompt: false },
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
    });
    expect(mockListComputerSessions).not.toHaveBeenCalled();
  });

  it('keeps healthy Mac results when another Mac is offline', async () => {
    mockGetComputerBridgeHealth.mockImplementation(async (bridgeId: string) => {
      if (bridgeId === SECOND.bridgeId) {
        throw new ComputerBridgeError('private transport detail', 'unavailable');
      }
      return {
        protocolVersion: 1,
        status: 'ready',
        capabilities: { sessionList: true, sessionLoad: false, sessionPrompt: false },
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

  it('fails a computer closed on repeated cursors or duplicate session handles', async () => {
    mockListComputerSessions.mockResolvedValue({
      sessions: [session('A', '2027-01-15T10:00:00.000Z')],
      nextCursor: 'repeat',
    });

    const result = await loadComputerSessionBoard([FIRST]);

    expect(result.sessions).toEqual([]);
    expect(result.computers[0]).toMatchObject({ state: 'invalid_response' });
    expect(mockListComputerSessions).toHaveBeenCalledTimes(2);
  });
});
