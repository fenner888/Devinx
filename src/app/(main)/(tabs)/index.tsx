/**
 * Home tab — Perplexity-style hero composer.
 * Wordmark, a friendly prompt, a large rounded composer, and a compact
 * recent-sessions list. The full session list lives in the Sessions tab.
 */
import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@theme/index';
import { useSessions, useCreateSession, usePlaybooks } from '@api/devin/queries';
import { OfflineBanner } from '@components/OfflineBanner';
import { ModeSettings } from '@components/ModeSettings';
import { hapticLight, hapticSuccess, hapticError } from '@lib/haptics';
import { deriveStatusKey, statusColorClass, statusLabel, relativeTime, prNumber, modeLabel } from '@lib/session-utils';
import type { DevinMode } from '@api/devin/types';
import WORDMARK_DARK from '../../../../assets/wordmark.png';
import WORDMARK_LIGHT from '../../../../assets/wordmark-light.png';

const MAX_PROMPT = 10000;

export default function HomeScreen() {
  const router = useRouter();
  const { name, tokens } = useTheme();
  const { data: sessions } = useSessions('board');
  const createSession = useCreateSession();
  const { data: playbooks } = usePlaybooks();

  const [prompt, setPrompt] = useState('');
  const [selectedPlaybook, setSelectedPlaybook] = useState<string | null>(null);
  const [mode, setMode] = useState<DevinMode>('normal');
  const [showPlaybookPicker, setShowPlaybookPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const recent = (sessions ?? []).slice(0, 5);
  const selectedPlaybookTitle = selectedPlaybook
    ? (playbooks?.find((p) => p.playbook_id === selectedPlaybook)?.title ?? 'Playbook')
    : null;

  function handleSend() {
    if (!prompt.trim() || createSession.isPending) return;
    hapticLight();
    setComposerError(null);
    createSession.mutate(
      { prompt: prompt.trim().slice(0, MAX_PROMPT), playbook_id: selectedPlaybook ?? undefined, devin_mode: mode },
      {
        onSuccess: (session) => {
          hapticSuccess();
          setPrompt('');
          setSelectedPlaybook(null);
          setMode('normal');
          router.push(`/(main)/session/${session.session_id}`);
        },
        onError: (e) => {
          hapticError();
          setComposerError(e instanceof Error ? e.message : 'Could not create session.');
        },
      },
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Top bar — wordmark only (no drawer) */}
      <View className="flex-row items-center px-5 pt-2 pb-1">
        <Image source={name === 'light' ? WORDMARK_LIGHT : WORDMARK_DARK} className="w-28 h-7" resizeMode="contain" accessibilityLabel="DevinX" />
      </View>

      <OfflineBanner />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow px-5 pt-6 pb-32"
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero prompt */}
          <Text className="text-text-hi text-text28 mb-1">What should Devin build?</Text>
          <Text className="text-text-mid text-text14 mb-6">
            Describe a task — it runs in the cloud and you can steer it here.
          </Text>

          {/* Composer */}
          <View className="bg-surface1 rounded-cardLg border border-border">
            <TextInput
              className="text-text-hi text-text16 px-5 pt-5 pb-2 min-h-[88px]"
              value={prompt}
              onChangeText={(v) => setPrompt(v.slice(0, MAX_PROMPT))}
              placeholder="Ask Devin to build features, fix bugs, or work on your code…"
              placeholderTextColor={tokens.textLow.hex}
              multiline
              maxLength={MAX_PROMPT}
              autoCapitalize="sentences"
              autoCorrect
              textAlignVertical="top"
              accessibilityLabel="Session prompt"
            />
            <View className="flex-row items-center justify-between px-3 pb-3">
              <View className="flex-row items-center gap-1">
                <Pressable
                  className="w-9 h-9 rounded-full items-center justify-center"
                  onPress={() => router.push('/(main)/compose')}
                  accessibilityRole="button"
                  accessibilityLabel="More options"
                >
                  <Ionicons name="add" size={22} color={tokens.textMid.hex} />
                </Pressable>
                <Pressable
                  className="flex-row items-center rounded-full px-3 py-2"
                  onPress={() => setShowModePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Execution mode"
                >
                  <Ionicons name="options-outline" size={15} color={tokens.textMid.hex} />
                  <Text className="text-text-mid text-text13 ml-1.5">{modeLabel(mode)}</Text>
                </Pressable>
                <Pressable
                  className="flex-row items-center rounded-full px-3 py-2"
                  onPress={() => setShowPlaybookPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select playbook"
                >
                  <Ionicons name="book-outline" size={14} color={selectedPlaybook ? tokens.brandText.hex : tokens.textMid.hex} />
                  <Text className={`text-text13 ml-1.5 max-w-28 ${selectedPlaybook ? 'text-brand-text' : 'text-text-mid'}`} numberOfLines={1}>
                    {selectedPlaybookTitle ?? 'Playbook'}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                className={`w-10 h-10 rounded-full items-center justify-center ${prompt.trim() ? 'bg-brand' : 'bg-tint-secondary'}`}
                onPress={handleSend}
                disabled={!prompt.trim() || createSession.isPending}
                accessibilityRole="button"
                accessibilityLabel="Start session"
              >
                {createSession.isPending ? (
                  <ActivityIndicator color={tokens.textAlwaysWhite.hex} size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color={prompt.trim() ? tokens.textAlwaysWhite.hex : tokens.textLow.hex} />
                )}
              </Pressable>
            </View>
          </View>
          {composerError && (
            <View className="flex-row items-center bg-tint-red rounded-card px-3 py-2 mt-3">
              <Ionicons name="alert-circle-outline" size={14} color={tokens.failed.hex} />
              <Text className="text-failed text-text12 ml-2 flex-1">{composerError}</Text>
            </View>
          )}

          {/* Recent */}
          {recent.length > 0 && (
            <View className="mt-8">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-text-hi text-text16 font-medium">Recent</Text>
                <Pressable onPress={() => router.push('/(main)/sessions')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text className="text-brand-text text-text13">View all</Text>
                </Pressable>
              </View>
              <View className="gap-2">
                {recent.map((session) => (
                  <Pressable
                    key={session.session_id}
                    className="bg-surface1 rounded-card border border-border-subtle px-4 py-3.5"
                    onPress={() => router.push(`/(main)/session/${session.session_id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${session.title || 'Untitled session'}, ${statusLabel(session)}`}
                  >
                    <Text className="text-text-hi text-text14" numberOfLines={1}>
                      {session.title || 'Untitled session'}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Text className={`text-text12 ${statusColorClass(deriveStatusKey(session))}`}>
                        {statusLabel(session)}
                      </Text>
                      <Text className="text-text-low text-text12 ml-2">{relativeTime(session.updated_at)}</Text>
                      {session.pull_requests[0] && (
                        <View className="flex-row items-center ml-auto">
                          <Ionicons name="git-pull-request-outline" size={12} color={tokens.merged.hex} />
                          <Text className="text-merged text-text12 ml-1">#{prNumber(session.pull_requests[0].pr_url)}</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Playbook picker */}
      <Modal visible={showPlaybookPicker} animationType="slide" transparent onRequestClose={() => setShowPlaybookPicker(false)}>
        <View className="flex-1 bg-scrim justify-end">
          <View className="bg-surface2 rounded-t-sheet px-5 py-4 max-h-[60%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Select playbook</Text>
              <Pressable onPress={() => setShowPlaybookPicker(false)}>
                <Text className="text-brand-text text-text14">Done</Text>
              </Pressable>
            </View>
            <ScrollView>
              <Pressable
                className={`flex-row items-center px-4 py-3 rounded-card mb-2 ${!selectedPlaybook ? 'bg-tint-blue' : 'bg-surface1'}`}
                onPress={() => { setSelectedPlaybook(null); setShowPlaybookPicker(false); }}
              >
                <Text className={`text-text14 ${!selectedPlaybook ? 'text-brand-text font-medium' : 'text-text-hi'}`}>No playbook</Text>
              </Pressable>
              {playbooks?.map((pb) => (
                <Pressable
                  key={pb.playbook_id}
                  className={`flex-row items-center px-4 py-3 rounded-card mb-2 ${selectedPlaybook === pb.playbook_id ? 'bg-tint-blue' : 'bg-surface1'}`}
                  onPress={() => { setSelectedPlaybook(pb.playbook_id); setShowPlaybookPicker(false); }}
                >
                  <Text className={`text-text14 flex-1 ${selectedPlaybook === pb.playbook_id ? 'text-brand-text font-medium' : 'text-text-hi'}`}>
                    {pb.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Mode picker */}
      <Modal visible={showModePicker} animationType="slide" transparent onRequestClose={() => setShowModePicker(false)}>
        <View className="flex-1 bg-scrim justify-end">
          <View className="bg-surface2 rounded-t-sheet px-5 py-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Session settings</Text>
              <Pressable onPress={() => setShowModePicker(false)}>
                <Text className="text-brand-text text-text14">Done</Text>
              </Pressable>
            </View>
            <ModeSettings mode={mode} onChange={setMode} checkColor={tokens.brandText.hex} mutedColor={tokens.textLow.hex} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
