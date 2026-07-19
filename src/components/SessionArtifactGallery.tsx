import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SessionAttachment } from '@api/devin/types';
import { useAttachmentFile } from '@api/devin/useAttachmentFile';
import { InlineImage, InlineVideo } from '@components/InlineMedia';
import { sessionArtifactKind } from '@lib/session-artifacts';
import { useTheme } from '@theme/index';

const MAX_TIMELINE_ARTIFACTS = 4;

type MediaArtifact = SessionAttachment & { kind: 'image' | 'video' };

export function SessionArtifactGallery({
  attachments,
  messageAttachments = [],
  includeUserAttachments = false,
  refreshing = false,
  onRefresh,
}: {
  attachments: SessionAttachment[];
  messageAttachments?: SessionAttachment[];
  includeUserAttachments?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { tokens } = useTheme();
  const messageAttachmentUrls = new Set(messageAttachments.map((attachment) => attachment.url));
  const merged = new Map<string, SessionAttachment>();
  for (const attachment of attachments) {
    if (
      attachment.source === 'devin' ||
      includeUserAttachments ||
      messageAttachmentUrls.has(attachment.url)
    ) {
      merged.set(attachment.url, attachment);
    }
  }
  for (const attachment of messageAttachments) {
    if (!merged.has(attachment.url)) merged.set(attachment.url, attachment);
  }
  const media = [...merged.values()]
    .map((attachment) => ({ ...attachment, kind: sessionArtifactKind(attachment) }))
    .filter(
      (attachment): attachment is MediaArtifact =>
        attachment.kind === 'image' || attachment.kind === 'video',
    );

  if (media.length === 0) return null;

  const visible = media.slice(0, MAX_TIMELINE_ARTIFACTS);
  const hiddenCount = media.length - visible.length;

  return (
    <View
      className="bg-surface1 rounded-card border border-border-subtle px-3 py-3 mb-4"
      accessibilityLabel="Devin demo and output files"
      testID="session-artifact-gallery"
    >
      <View className="flex-row items-center mb-2">
        <Ionicons name="images-outline" size={15} color={tokens.brandText.hex} />
        <Text className="text-text-hi text-text13 font-semibold ml-2 flex-1">
          Demo &amp; output
        </Text>
        {onRefresh && (
          <Pressable
            className="w-9 h-9 items-center justify-center rounded-full"
            onPress={onRefresh}
            disabled={refreshing}
            accessibilityRole="button"
            accessibilityLabel="Refresh demo and output files"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={tokens.brandText.hex} />
            ) : (
              <Ionicons name="refresh" size={15} color={tokens.textMid.hex} />
            )}
          </Pressable>
        )}
      </View>

      {visible.map((attachment, index) => (
        <View key={attachment.attachment_id} className={index < visible.length - 1 ? 'mb-4' : ''}>
          <View className="flex-row items-center mb-1">
            <Ionicons
              name={attachment.kind === 'image' ? 'image-outline' : 'videocam-outline'}
              size={14}
              color={tokens.textMid.hex}
            />
            <Text className="text-text-mid text-text12 ml-2 flex-1" numberOfLines={1}>
              {attachment.name}
            </Text>
            <Text className="text-text-low text-text11 ml-2">
              {attachment.source === 'devin' || messageAttachmentUrls.has(attachment.url)
                ? 'Added by Devin'
                : 'Added by you'}
            </Text>
          </View>
          {attachment.kind === 'image' ? (
            <AuthenticatedImageArtifact attachment={attachment} />
          ) : (
            <LazyVideoArtifact attachment={attachment} />
          )}
        </View>
      ))}

      {hiddenCount > 0 && (
        <Text className="text-text-low text-text11 mt-2">
          {hiddenCount} more media {hiddenCount === 1 ? 'file' : 'files'} available in Worklog.
        </Text>
      )}
    </View>
  );
}

function AuthenticatedImageArtifact({ attachment }: { attachment: MediaArtifact }) {
  const { tokens } = useTheme();
  const [requestKey, setRequestKey] = useState(0);
  const file = useAttachmentFile(attachment, true, requestKey);

  if (file.status === 'ready') {
    return <InlineImage uri={file.uri} alt={attachment.name} />;
  }

  return (
    <View className="aspect-video rounded-card bg-surface2 border border-border-subtle items-center justify-center my-1.5">
      {file.status === 'loading' || file.status === 'idle' ? (
        <>
          <ActivityIndicator size="small" color={tokens.brandText.hex} />
          <Text className="text-text-mid text-text12 mt-2">Loading image…</Text>
        </>
      ) : (
        <Pressable
          className="min-h-11 px-3 items-center justify-center"
          onPress={() => setRequestKey((current) => current + 1)}
          accessibilityRole="button"
          accessibilityLabel={`Retry loading ${attachment.name}`}
        >
          <Ionicons name="image-outline" size={20} color={tokens.textLow.hex} />
          <Text className="text-text-mid text-text12 mt-2">Image unavailable · Tap to retry</Text>
        </Pressable>
      )}
    </View>
  );
}

function LazyVideoArtifact({ attachment }: { attachment: MediaArtifact }) {
  const { tokens } = useTheme();
  const [opened, setOpened] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const file = useAttachmentFile(attachment, opened, requestKey);

  if (file.status === 'ready') {
    return <InlineVideo uri={file.uri} accessibilityLabel={`Video demo: ${attachment.name}`} />;
  }

  if (opened) {
    return (
      <View className="aspect-video rounded-card bg-surface2 border border-border-subtle items-center justify-center my-1.5">
        {file.status === 'loading' || file.status === 'idle' ? (
          <>
            <ActivityIndicator size="small" color={tokens.brandText.hex} />
            <Text className="text-text-mid text-text12 mt-2">Loading video…</Text>
          </>
        ) : (
          <Pressable
            className="min-h-11 px-3 items-center justify-center"
            onPress={() => setRequestKey((current) => current + 1)}
            accessibilityRole="button"
            accessibilityLabel={`Retry loading ${attachment.name}`}
          >
            <Ionicons name="videocam-outline" size={20} color={tokens.textLow.hex} />
            <Text className="text-text-mid text-text12 mt-2">Video unavailable · Tap to retry</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <Pressable
      className="aspect-video rounded-card bg-surface2 border border-border-subtle items-center justify-center my-1.5"
      onPress={() => setOpened(true)}
      accessibilityRole="button"
      accessibilityLabel={`Play ${attachment.name}`}
      accessibilityHint="Loads the video and displays native playback controls"
    >
      <View className="w-12 h-12 rounded-full bg-brand items-center justify-center">
        <Ionicons name="play" size={22} color={tokens.textAlwaysWhite.hex} />
      </View>
      <Text className="text-text-mid text-text12 mt-2">Tap to load video</Text>
    </Pressable>
  );
}
