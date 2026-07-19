import { Directory, File, Paths } from 'expo-file-system';
import type { AuthProvider } from '@auth/AuthProvider';
import type { SessionAttachment } from '@api/devin/types';
import { isSafeSessionArtifactUrl } from '@lib/session-artifacts';

const CACHE_DIRECTORY_NAME = 'devinx-session-artifacts';
const MAX_ATTACHMENT_BYTES = 250 * 1024 * 1024;
const API_HOST = 'api.devin.ai';
const WEB_APP_HOST = 'app.devin.ai';
const WEB_ATTACHMENT_PATH = /^\/attachments\/([^/]+)\/([^/]+)$/;

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
 * Session messages may contain a canonical web-app attachment URL. That URL
 * is intended for an authenticated browser session and does not accept a
 * service-user bearer token. Convert it to the documented organization API
 * endpoint, which returns a short-lived presigned download redirect.
 */
async function authenticatedDownloadUrl(
  auth: AuthProvider,
  attachmentUrl: string,
): Promise<{ url: string; headers?: Record<string, string> }> {
  const parsed = new URL(attachmentUrl);

  if (parsed.hostname === WEB_APP_HOST) {
    const match = WEB_ATTACHMENT_PATH.exec(parsed.pathname);
    if (!match) throw new Error('Attachment URL is not supported');

    const encodedUuid = match[1];
    const encodedName = match[2];
    if (!encodedUuid || !encodedName) throw new Error('Attachment URL is not supported');
    const uuid = decodeURIComponent(encodedUuid);
    const name = decodeURIComponent(encodedName);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uuid) || !name || name.length > 255) {
      throw new Error('Attachment URL is not supported');
    }

    const base = (process.env.EXPO_PUBLIC_API_BASE_URL || `https://${API_HOST}`).replace(/\/$/, '');
    const orgPath = await auth.orgPath();
    return {
      url: `${base}${orgPath}/attachments/${encodeURIComponent(uuid)}/${encodeURIComponent(name)}`,
      headers: await auth.authHeaders(),
    };
  }

  if (parsed.hostname === API_HOST) {
    return { url: attachmentUrl, headers: await auth.authHeaders() };
  }

  return { url: attachmentUrl };
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

  const request = await authenticatedDownloadUrl(auth, attachment.url);
  const destination = new File(cacheDirectory(), safeCacheName(attachment));

  try {
    const downloaded = await File.downloadFileAsync(request.url, destination, {
      headers: request.headers,
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
