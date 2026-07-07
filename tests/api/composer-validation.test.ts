/**
 * §10.7 gate test — composer payload validation.
 * Outbound session-create and message-send payloads are validated through zod
 * before hitting the network.
 */

import { sessionCreateRequestSchema, sessionMessageCreateRequestSchema } from '../../src/api/devin/schemas';

describe('composer payload validation (§10.7)', () => {
  it('accepts a valid session create payload', () => {
    const payload = { prompt: 'Fix the login bug', tags: ['mobile', 'urgent'] };
    expect(() => sessionCreateRequestSchema.parse(payload)).not.toThrow();
  });

  it('rejects an empty prompt', () => {
    expect(() => sessionCreateRequestSchema.parse({ prompt: '' })).toThrow();
  });

  it('rejects a missing prompt', () => {
    expect(() => sessionCreateRequestSchema.parse({ tags: ['x'] })).toThrow();
  });

  it('accepts a valid message payload', () => {
    const payload = { message: 'Can you add tests for this?' };
    expect(() => sessionMessageCreateRequestSchema.parse(payload)).not.toThrow();
  });

  it('rejects an empty message', () => {
    expect(() => sessionMessageCreateRequestSchema.parse({ message: '' })).toThrow();
  });

  it('rejects a message with invalid attachment URLs', () => {
    expect(() =>
      sessionMessageCreateRequestSchema.parse({
        message: 'hi',
        attachment_urls: ['not-a-url'],
      }),
    ).toThrow();
  });

  it('accepts a message with valid attachment URLs', () => {
    expect(() =>
      sessionMessageCreateRequestSchema.parse({
        message: 'hi',
        attachment_urls: ['https://example.com/file.txt'],
      }),
    ).not.toThrow();
  });
});
