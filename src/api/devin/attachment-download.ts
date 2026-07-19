import { Directory, File, Paths } from 'expo-file-system';
import type { AuthProvider } from '@auth/AuthProvider';
import type { SessionAttachment } from '@api/devin/types';
import { isSafeSessionArtifactUrl } from '@lib/session-artifacts';

const CACHE_DIRECTORY_NAME = 'devinx-session-artifacts';
const MAX_ATTACHMENT_BYTES = 250 * 1024 * 1024;
const AUTHENTICATED_ATTACHMENT_HOSTS = new Set(['api.devin.ai', 'app.devin.ai']);

function cacheDirectory(): Directory {
  const directory = new Directory(Paths.cache, CACHE_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function safeCacheName(attachment: SessionAttachment): string {
  const id = attachment.attachment_id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96);
  const extension = attachment.name.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0]?.toLowerCase() ?? '';
  return `${id || 'attachment'}${extension}`;
}

/**
 * Downloads a Devin attachment into the OS-managed cache. Authorization is
 * attached only for Devin-owned hosts, so a compromised attachment record
 * cannot exfiltrate the service-user credential to an arbitrary server.
 */
export async function downloadSessionAttachment(
  auth: AuthProvider,
  attachment: SessionAttachment,
): Promise<string> {
  if (!isSafeSessionArtifactUrl(attachment.url)) {
    throw new Error('Attachment URL is not allowed');
  }

  const url = new URL(attachment.url);
  const headers = AUTHENTICATED_ATTACHMENT_HOSTS.has(url.hostname)
    ? await auth.authHeaders()
    : undefined;
  const destination = new File(cacheDirectory(), safeCacheName(attachment));

  try {
    const downloaded = await File.downloadFileAsync(attachment.url, destination, {
      headers,
      idempotent: true,
    });
    if ((downloaded.size ?? 0) > MAX_ATTACHMENT_BYTES) {
      downloaded.delete();
      throw new Error('Attachment exceeds the preview size limit');
    }
    return downloaded.uri;
  } catch {
    if (destination.exists) destination.delete();
    throw new Error('Attachment could not be downloaded');
  }
}

export function removeCachedSessionAttachment(uri: string): void {
  const directory = cacheDirectory();
  if (!uri.startsWith(directory.uri)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
