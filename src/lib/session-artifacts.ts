import type { SessionAttachment } from '@api/devin/types';

export type SessionArtifactKind = 'image' | 'video' | 'file' | 'unsafe';

export interface ParsedSessionMessageArtifacts {
  displayText: string;
  attachments: SessionAttachment[];
}

const IMAGE_CONTENT_TYPES = new Set([
  'image/gif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const VIDEO_CONTENT_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']);

const GENERIC_CONTENT_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

const IMAGE_EXTENSION_RE = /\.(gif|heic|heif|jpe?g|png|webp)$/i;
const VIDEO_EXTENSION_RE = /\.(m4v|mov|mp4|webm)$/i;
const ATTACHMENT_MARKER_RE = /ATTACHMENT:\s*(\{[^\r\n]{1,8192}\})/g;

export function isSafeSessionArtifactUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !!url.hostname;
  } catch {
    return false;
  }
}

function normalizedContentType(contentType: string | null | undefined): string {
  return contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

function extensionKind(value: string): SessionArtifactKind {
  try {
    const path = decodeURIComponent(new URL(value).pathname);
    if (IMAGE_EXTENSION_RE.test(path)) return 'image';
    if (VIDEO_EXTENSION_RE.test(path)) return 'video';
  } catch {
    return 'unsafe';
  }
  return 'file';
}

/**
 * Classifies a validated session-output attachment without trusting a query
 * string or filename alone. The API content type is authoritative unless it
 * is absent/generic, in which case the HTTPS URL path is a bounded fallback.
 */
export function sessionArtifactKind(
  attachment: Pick<SessionAttachment, 'content_type' | 'url'>,
): SessionArtifactKind {
  if (!isSafeSessionArtifactUrl(attachment.url)) return 'unsafe';

  const contentType = normalizedContentType(attachment.content_type);
  if (IMAGE_CONTENT_TYPES.has(contentType)) return 'image';
  if (VIDEO_CONTENT_TYPES.has(contentType)) return 'video';
  if (!GENERIC_CONTENT_TYPES.has(contentType)) return 'file';
  return extensionKind(attachment.url);
}

function contentTypeForName(name: string): string | null {
  const lower = name.toLowerCase();
  if (/\.(png)$/.test(lower)) return 'image/png';
  if (/\.(jpe?g)$/.test(lower)) return 'image/jpeg';
  if (/\.(gif)$/.test(lower)) return 'image/gif';
  if (/\.(webp)$/.test(lower)) return 'image/webp';
  if (/\.(heic|heif)$/.test(lower)) return `image/${lower.endsWith('heif') ? 'heif' : 'heic'}`;
  if (/\.(mp4|m4v)$/.test(lower)) return lower.endsWith('m4v') ? 'video/x-m4v' : 'video/mp4';
  if (/\.(mov)$/.test(lower)) return 'video/quicktime';
  if (/\.(webm)$/.test(lower)) return 'video/webm';
  return null;
}

function attachmentName(url: string): string {
  try {
    const pathName = new URL(url).pathname.split('/').filter(Boolean).at(-1);
    return pathName ? decodeURIComponent(pathName).slice(0, 180) : 'Devin attachment';
  } catch {
    return 'Devin attachment';
  }
}

function stableReferenceId(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 2147483647;
  }
  return `message-attachment-${hash.toString(16)}`;
}

/**
 * Devin may append machine-readable ATTACHMENT JSON markers to an otherwise
 * normal chat message. Convert only valid HTTPS markers into typed attachment
 * references and remove those transport markers from the visible transcript.
 */
export function parseSessionMessageArtifacts(message: string): ParsedSessionMessageArtifacts {
  const attachments: SessionAttachment[] = [];
  const displayText = message.replace(ATTACHMENT_MARKER_RE, (marker, json: string) => {
    try {
      const value: unknown = JSON.parse(json);
      if (!value || typeof value !== 'object' || !('url' in value)) return marker;
      const url = (value as { url?: unknown }).url;
      if (typeof url !== 'string' || !isSafeSessionArtifactUrl(url)) return marker;
      const name = attachmentName(url);
      attachments.push({
        attachment_id: stableReferenceId(url),
        name,
        source: 'devin',
        url,
        content_type: contentTypeForName(name),
      });
      return '';
    } catch {
      return marker;
    }
  });

  return {
    displayText: displayText
      .replace(/\n[ \t]+\n/g, '\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    attachments,
  };
}
