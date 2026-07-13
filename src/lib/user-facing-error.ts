import { ApiError } from '@api/devin/client';
import { ApiSchemaError } from '@auth/AuthProvider';

export function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof ApiSchemaError) return fallback;
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'auth':
        return 'Your Devin connection needs attention. Reconnect it in Settings.';
      case 'permission':
        return 'This Devin connection does not have permission for that action.';
      case 'not_found':
        return 'This item is no longer available.';
      case 'rate_limited':
        return 'Devin is receiving too many requests. Wait a moment and try again.';
      case 'network':
        return 'Could not reach Devin. Check your connection and try again.';
      case 'server':
      case 'schema':
      case 'unknown':
        return fallback;
    }
  }
  return fallback;
}
