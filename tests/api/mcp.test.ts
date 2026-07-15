import type { AuthProvider } from '../../src/auth/AuthProvider';
import {
  askWikiQuestion,
  listIntegrationCatalog,
  readWikiStructure,
} from '../../src/api/devin/mcp';

const mockAuth: AuthProvider = {
  kind: 'service_user',
  authHeaders: async () => ({ Authorization: 'Bearer cog_test_secret' }),
  orgPath: async () => '/v3/organizations/org-test',
  credentialFingerprint: async () => 'cret',
  sessionAttribution: async () => ({}),
  validate: async () => ({ ok: true }),
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function response(body: string, status = 200, headers = new Headers()) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    text: async () => body,
  };
}

function sse(value: unknown): string {
  return `event: message\ndata: ${JSON.stringify(value)}\n\n`;
}

function initializeResponse(id: number) {
  const headers = new Headers();
  headers.set('Mcp-Session-Id', 'mcp-session-test');
  return response(
    sse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'Devin', version: 'test' },
      },
    }),
    200,
    headers,
  );
}

function toolResponse(id: number, result: unknown) {
  return response(
    sse({
      jsonrpc: '2.0',
      id,
      result,
    }),
  );
}

function requestBody(callIndex: number): Record<string, unknown> {
  const init = mockFetch.mock.calls[callIndex]?.[1] as { body?: string };
  return JSON.parse(init.body ?? '{}') as Record<string, unknown>;
}

describe('official Devin MCP client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('negotiates Streamable HTTP and normalizes integrations without exposing settings writes', async () => {
    mockFetch
      .mockImplementationOnce((_url, init) => {
        const id = requestBodyFromInit(init).id as number;
        return initializeResponse(id);
      })
      .mockResolvedValueOnce(response('', 202))
      .mockImplementationOnce((_url, init) => {
        const id = requestBodyFromInit(init).id as number;
        return toolResponse(id, {
          content: [{ type: 'text', text: 'catalog' }],
          structuredContent: {
            integrations: [
              { id: 'github', name: 'GitHub', installed: true, settings_url: '/private' },
            ],
            mcp_servers: [{ slug: 'sentry', display_name: 'Sentry', status: 'not installed' }],
          },
        });
      });

    const catalog = await listIntegrationCatalog(mockAuth);

    expect(catalog.integrations).toEqual([
      expect.objectContaining({ id: 'github', name: 'GitHub', status: 'installed' }),
    ]);
    expect(catalog.mcpServers).toEqual([
      expect.objectContaining({ id: 'sentry', name: 'Sentry', status: 'not_installed' }),
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(requestBody(0)).toMatchObject({ method: 'initialize' });
    expect(requestBody(1)).toMatchObject({ method: 'notifications/initialized' });
    expect(requestBody(2)).toMatchObject({
      method: 'tools/call',
      params: { name: 'list_integrations', arguments: {} },
    });

    const callHeaders = mockFetch.mock.calls[2]?.[1]?.headers as Record<string, string>;
    expect(callHeaders.Authorization).toBe('Bearer cog_test_secret');
    expect(callHeaders['MCP-Protocol-Version']).toBe('2025-06-18');
    expect(callHeaders['X-Org-Id']).toBe('org-test');
    expect(callHeaders['Mcp-Session-Id']).toBe('mcp-session-test');
    expect(JSON.stringify(requestBody(2))).not.toContain('cog_test_secret');
  });

  it('uses the documented repoName argument for Wiki reads', async () => {
    mockFetch
      .mockImplementationOnce((_url, init) => {
        const id = requestBodyFromInit(init).id as number;
        return initializeResponse(id);
      })
      .mockResolvedValueOnce(response('', 202))
      .mockImplementationOnce((_url, init) => {
        const id = requestBodyFromInit(init).id as number;
        return toolResponse(id, {
          content: [{ type: 'text', text: '# Architecture' }],
        });
      });

    await expect(readWikiStructure(mockAuth, 'fenner888/DevinX')).resolves.toBe('# Architecture');
    expect(requestBody(2)).toMatchObject({
      method: 'tools/call',
      params: {
        name: 'read_wiki_structure',
        arguments: { repoName: 'fenner888/DevinX' },
      },
    });
  });

  it('maps missing MCP permission without leaking the response body', async () => {
    mockFetch.mockResolvedValue(response('sensitive server detail', 403));
    await expect(listIntegrationCatalog(mockAuth)).rejects.toMatchObject({
      code: 'permission',
      status: 403,
      message: 'This connection cannot access Devin MCP',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed tool results as schema failures', async () => {
    mockFetch
      .mockImplementationOnce((_url, init) => {
        const id = requestBodyFromInit(init).id as number;
        return initializeResponse(id);
      })
      .mockResolvedValueOnce(response('', 202))
      .mockImplementationOnce((_url, init) => {
        const id = requestBodyFromInit(init).id as number;
        return toolResponse(id, { unexpected: true });
      });

    await expect(listIntegrationCatalog(mockAuth)).rejects.toMatchObject({
      code: 'schema',
    });
  });

  it('rejects invalid Wiki inputs before making a network request', async () => {
    await expect(readWikiStructure(mockAuth, '   ')).rejects.toMatchObject({ code: 'schema' });
    await expect(
      askWikiQuestion(mockAuth, 'fenner888/DevinX', 'x'.repeat(4_001)),
    ).rejects.toMatchObject({
      code: 'schema',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

function requestBodyFromInit(init: unknown): Record<string, unknown> {
  const body = (init as { body?: string }).body;
  return JSON.parse(body ?? '{}') as Record<string, unknown>;
}
