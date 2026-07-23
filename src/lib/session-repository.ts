import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DevinMode, SessionResponse } from '@api/devin/types';

const PREFIX = '@devinx/session-repository/';
const MODE_PREFIX = '@devinx/session-mode/';

export async function rememberSessionRepository(sessionId: string, repository?: string | null) {
  if (!repository) return;
  await AsyncStorage.setItem(`${PREFIX}${sessionId}`, repository);
}

export async function rememberSessionMode(sessionId: string, mode: DevinMode) {
  await AsyncStorage.setItem(`${MODE_PREFIX}${sessionId}`, mode);
}

export async function getSessionMode(sessionId: string): Promise<DevinMode | null> {
  const mode = await AsyncStorage.getItem(`${MODE_PREFIX}${sessionId}`);
  return mode === 'normal' ||
    mode === 'fast' ||
    mode === 'lite' ||
    mode === 'ultra' ||
    mode === 'fusion'
    ? mode
    : null;
}

export async function getSessionRepository(session: SessionResponse): Promise<string | null> {
  const remembered = await AsyncStorage.getItem(`${PREFIX}${session.session_id}`);
  if (remembered) return remembered;
  const prUrl = session.pull_requests.find((pr) => pr.pr_url)?.pr_url;
  if (!prUrl) return null;
  try {
    const url = new URL(prUrl);
    const [owner, repository] = url.pathname.split('/').filter(Boolean);
    return owner && repository ? `${owner}/${repository}` : null;
  } catch {
    return null;
  }
}
