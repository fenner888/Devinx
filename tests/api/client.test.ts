/**
 * §8.4 gate test — client error handling.
 * Verifies the client does NOT retry on 401 and classifies it as 'auth'.
 * Also verifies 5xx DOES retry, 429 sets cooldown, schema parsing works.
 */

import { apiRequest, clearRateLimit, isRateLimited } from '../../src/api/devin/client';
import { ApiSchemaError } from '../../src/auth/AuthProvider';
import { z } from 'zod';
import type { AuthProvider } from '../../src/auth/AuthProvider';

// Mock auth provider
const mockAuth: AuthProvider = {
  kind: 'service_user',
  authHeaders: async () => ({ Authorization: 'Bearer cog_test' }),
  orgPath: async () => '/v3/organizations/org-test',
  credentialFingerprint: async () => 'test',
  sessionAttribution: async () => ({}),
  validate: async () => ({ ok: true }),
};

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Polyfill AbortSignal.timeout for older Node
if (typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = function (ms: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  text: async () => JSON.stringify(data),
  json: async () => data,
});

const emptyResponse = (status = 204) => ({
  ok: true,
  status,
  headers: new Headers(),
  text: async () => '',
  json: async () => {
    throw new SyntaxError('Unexpected end of JSON input');
  },
});

const errResponse = (status: number, headers?: Headers) => ({
  ok: false,
  status,
  headers: headers ?? new Headers(),
  text: async () => JSON.stringify({ detail: 'error' }),
  json: async () => ({ detail: 'error' }),
});

describe('client error handling (§8.4)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    clearRateLimit();
  });

  it('classifies 401 as auth error and does NOT retry', async () => {
    mockFetch.mockResolvedValue(errResponse(401));
    await expect(apiRequest(mockAuth, '/test')).rejects.toThrow(/Authentication failed/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retain a non-auth 4xx response body in the thrown error', async () => {
    mockFetch.mockResolvedValue({
      ...errResponse(422),
      text: async () => JSON.stringify({ detail: 'private prompt and secret metadata' }),
    });

    const request = apiRequest(mockAuth, '/test', {
      method: 'POST',
      body: { prompt: 'private prompt' },
    });

    await expect(request).rejects.toThrow('Unexpected status: 422');
    await expect(request).rejects.not.toThrow(/private prompt|secret metadata/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx errors up to maxRetries', async () => {
    mockFetch.mockResolvedValue(errResponse(503));
    await expect(apiRequest(mockAuth, '/test', { maxRetries: 2 })).rejects.toThrow(/Server error/);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('retries network errors up to maxRetries', async () => {
    mockFetch.mockRejectedValue(new Error('network request failed'));
    await expect(apiRequest(mockAuth, '/test', { maxRetries: 1 })).rejects.toThrow(/Network error/);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('sets rate-limit cooldown on 429 and retries', async () => {
    const headers = new Headers();
    headers.set('Retry-After', '0'); // 0 seconds — immediate retry
    mockFetch
      .mockResolvedValueOnce(errResponse(429, headers))
      .mockResolvedValueOnce(okResponse({ ok: true }));
    const result = await apiRequest(mockAuth, '/test', { maxRetries: 1 });
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('parses a successful response through a zod schema', async () => {
    mockFetch.mockResolvedValue(okResponse({ tags: ['a', 'b'] }));
    const schema = z.object({ tags: z.array(z.string()) }).passthrough();
    const result = await apiRequest<{ tags: string[] }>(mockAuth, '/test', { schema });
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('throws ApiSchemaError on schema mismatch', async () => {
    mockFetch.mockResolvedValue(okResponse({ wrong_field: true }));
    const schema = z.object({ tags: z.array(z.string()) }).passthrough();
    await expect(apiRequest(mockAuth, '/test', { schema })).rejects.toThrow(ApiSchemaError);
  });

  it('does NOT retry non-idempotent requests (POST) on 5xx', async () => {
    mockFetch.mockResolvedValue(errResponse(503));
    await expect(
      apiRequest(mockAuth, '/test', { method: 'POST', body: { prompt: 'x' }, maxRetries: 3 }),
    ).rejects.toThrow(/Server error/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry POST on network error (may have succeeded server-side)', async () => {
    mockFetch.mockRejectedValue(new Error('network request failed'));
    await expect(
      apiRequest(mockAuth, '/test', { method: 'POST', body: { prompt: 'x' }, maxRetries: 3 }),
    ).rejects.toThrow(/Network error/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('treats a 204/empty body as success instead of a JSON error', async () => {
    mockFetch.mockResolvedValue(emptyResponse());
    await expect(apiRequest(mockAuth, '/test', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('parses an HTTP-date Retry-After without producing a NaN cooldown', async () => {
    const headers = new Headers();
    headers.set('Retry-After', new Date(Date.now() + 30_000).toUTCString());
    mockFetch.mockResolvedValue(errResponse(429, headers));
    await expect(apiRequest(mockAuth, '/test', { maxRetries: 0 })).rejects.toThrow(/Rate limited/);
    expect(isRateLimited()).toBe(true);
  });
});
