/**
 * Inline media for chat messages — tappable images (full-screen viewer),
 * video (expo-video), and audio (expo-audio) players. Used by DevinMarkdown.
 */
import { useState } from 'react';
import { View, Text, Pressable, Modal, Image, useWindowDimensions, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '@theme/index';

const VIDEO_RE = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;
const AUDIO_RE = /\.(mp3|wav|m4a|aac|ogg|oga)(\?|#|$)/i;

export function isVideoUrl(url: string): boolean {
  return VIDEO_RE.test(url);
}
export function isAudioUrl(url: string): boolean {
  return AUDIO_RE.test(url);
}

/** Tappable inline image that opens a full-screen viewer. */
export function InlineImage({ uri }: { uri: string }) {
  const { width } = useWindowDimensions();
  const { tokens } = useTheme();
  const [ratio, setRatio] = useState(16 / 9);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const maxW = Math.min(width - 32, 520);

  if (failed) {
    return (
      <Pressable className="flex-row items-center bg-surface2 rounded-card px-3 py-2 my-1.5" onPress={() => setOpen(true)}>
        <Ionicons name="image-outline" size={14} color={tokens.textLow.hex} />
        <Text className="text-text-low text-text12 ml-2 flex-1" numberOfLines={1}>{uri}</Text>
      </Pressable>
    );
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="imagebutton" accessibilityLabel="Image, tap to enlarge">
        <Image
          source={{ uri }}
          style={[sheet.media, { width: maxW, height: maxW / ratio }]}
          resizeMode="cover"
          onLoad={(e) => {
            const { width: w, height: h } = e.nativeEvent.source;
            if (w && h) setRatio(w / h);
          }}
          onError={() => setFailed(true)}
        />
      </Pressable>
      <ImageViewer uri={uri} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ImageViewer({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        <Pressable className="flex-1 items-center justify-center" onPress={onClose}>
          <Image source={{ uri }} style={sheet.full} resizeMode="contain" />
        </Pressable>
        <Pressable
          className="absolute right-4 w-10 h-10 rounded-full bg-tint-secondary items-center justify-center"
          style={{ top: insets.top + 8 }}
          onPress={onClose}
          accessibilityLabel="Close image"
        >
          <Ionicons name="close" size={20} color={tokens.textAlwaysWhite.hex} />
        </Pressable>
      </View>
    </Modal>
  );
}

/** Inline video with native controls. */
export function InlineVideo({ uri }: { uri: string }) {
  const { width } = useWindowDimensions();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  const w = Math.min(width - 32, 520);
  return (
    <VideoView
      player={player}
      style={[sheet.media, sheet.video, { width: w, height: w * (9 / 16) }]}
      nativeControls
      contentFit="contain"
    />
  );
}

/** Inline audio with a play/pause button and progress. */
export function InlineAudio({ uri }: { uri: string }) {
  const { tokens } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  const loading = !status.isLoaded;

  return (
    <View className="flex-row items-center bg-surface2 rounded-card px-3 py-2.5 my-1.5">
      <Pressable
        className="w-9 h-9 rounded-full bg-brand items-center justify-center mr-3"
        onPress={() => (playing ? player.pause() : player.play())}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
      >
        {loading ? (
          <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
        ) : (
          <Ionicons name={playing ? 'pause' : 'play'} size={18} color={tokens.textAlwaysWhite.hex} />
        )}
      </Pressable>
      <View className="flex-1">
        <Text className="text-text-hi text-text13" numberOfLines={1}>Audio clip</Text>
        <Text className="text-text-low text-text12">
          {formatTime(status.currentTime)} / {formatTime(status.duration)}
        </Text>
      </View>
    </View>
  );
}

function formatTime(sec?: number): string {
  if (!sec || !Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const sheet = StyleSheet.create({
  media: { borderRadius: 10, marginVertical: 6 },
  full: { width: '100%', height: '100%' },
  video: { backgroundColor: '#000' },
});
