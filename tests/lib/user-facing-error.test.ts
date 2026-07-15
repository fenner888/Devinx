import { ApiError } from '../../src/api/devin/client';
import { ApiSchemaError } from '../../src/auth/AuthProvider';
import { userFacingError } from '../../src/lib/user-facing-error';

describe('user-facing errors', () => {
  it('never exposes API response details', () => {
    const error = new ApiError(
      'Unexpected status: 422 — {"detail":"secret repository path"}',
      422,
      'unknown',
    );
    expect(userFacingError(error, 'Could not save.')).toBe('Could not save.');
  });

  it('maps stable error classes to actionable copy', () => {
    expect(userFacingError(new ApiError('raw', 401, 'auth'), 'fallback')).toMatch(/Reconnect/);
    expect(userFacingError(new ApiError('raw', 403, 'permission'), 'fallback')).toMatch(
      /permission/,
    );
    expect(userFacingError(new ApiError('raw', 0, 'network'), 'fallback')).toMatch(/reach Devin/);
  });

  it('does not expose schema paths or issues', () => {
    const error = new ApiSchemaError('raw details', '/private/path', []);
    expect(userFacingError(error, 'Could not load.')).toBe('Could not load.');
  });
});
