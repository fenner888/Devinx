import {
  bodySchemas,
  permissionByMethod,
  sessionPermissionDecisionSchema,
} from '../../bridge/src/schemas';

describe('local interaction request schemas', () => {
  it.each(['bridge.features', 'session.list', 'session.load', 'session.activity'] as const)(
    'accepts interaction opt-in for %s',
    (method) => {
      const body =
        method === 'session.list'
          ? { interaction: true }
          : method === 'bridge.features'
            ? { interaction: true }
            : { sessionId: 'session-one', interaction: true };
      expect(bodySchemas[method].parse(body)).toEqual(body);
      expect(() => bodySchemas[method].parse({ ...body, interaction: false })).toThrow();
    },
  );

  it('keeps permission request bodies strict and validates public handles', () => {
    expect(permissionByMethod['session.permission']).toBe('session:content:read');
    expect(permissionByMethod['session.permission.respond']).toBe('session:prompt:send');
    expect(bodySchemas['session.permission'].parse({ sessionId: 'session-one' })).toEqual({
      sessionId: 'session-one',
    });
    expect(
      bodySchemas['session.permission.respond'].parse({
        sessionId: 'session-one',
        permissionId: `permission_${'A'.repeat(43)}`,
        decision: 'allow_once',
      }),
    ).toMatchObject({ decision: 'allow_once' });
    expect(() =>
      bodySchemas['session.permission.respond'].parse({
        sessionId: 'session-one',
        permissionId: 'allow_once',
        decision: 'allow_once',
      }),
    ).toThrow();
    expect(sessionPermissionDecisionSchema.options).toEqual([
      'allow_once',
      'allow_session',
      'reject_once',
    ]);
  });
});
