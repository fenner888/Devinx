import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@auth/AuthContext';
import type { SessionAttachment } from '@api/devin/types';
import {
  downloadSessionAttachment,
  removeCachedSessionAttachment,
} from '@api/devin/attachment-download';

type AttachmentFileState =
  | { status: 'idle' | 'loading'; uri: null }
  | { status: 'ready'; uri: string }
  | { status: 'error'; uri: null };

/** Keeps authenticated attachment bytes out of UI state and query caches. */
export function useAttachmentFile(
  attachment: SessionAttachment,
  enabled: boolean,
  requestKey = 0,
): AttachmentFileState {
  const { provider, isAuthenticated } = useAuth();
  const [state, setState] = useState<AttachmentFileState>({ status: 'idle', uri: null });
  const stableAttachment = useMemo<SessionAttachment>(
    () => ({
      attachment_id: attachment.attachment_id,
      content_type: attachment.content_type,
      name: attachment.name,
      source: attachment.source,
      url: attachment.url,
    }),
    [
      attachment.attachment_id,
      attachment.content_type,
      attachment.name,
      attachment.source,
      attachment.url,
    ],
  );

  useEffect(() => {
    if (!enabled || !provider || !isAuthenticated) {
      setState({ status: 'idle', uri: null });
      return;
    }

    let active = true;
    let localUri: string | null = null;
    setState({ status: 'loading', uri: null });

    downloadSessionAttachment(provider, stableAttachment)
      .then((uri) => {
        localUri = uri;
        if (active) setState({ status: 'ready', uri });
        else removeCachedSessionAttachment(uri);
      })
      .catch(() => {
        if (active) setState({ status: 'error', uri: null });
      });

    return () => {
      active = false;
      if (localUri) removeCachedSessionAttachment(localUri);
    };
  }, [enabled, isAuthenticated, provider, requestKey, stableAttachment]);

  return state;
}
