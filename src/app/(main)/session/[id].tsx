/**
 * Session Detail — spec §7.3.
 * Header with status, title, PR badges.
 * Tabbed: Timeline (messages) | Worklog | Changes (PRs).
 * Message steering: send message to session.
 * Polls with useSession + useMessages hooks.
 */
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  FlatList,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession, useMessages, useSendMessage } from '@api/devin/queries';
import { isValidSessionId } from '@lib/deepLink';
import { SessionDetailSkeleton, ErrorState } from '@components/Skeletons';
import { hapticLight, hapticSuccess, hapticError } from '@lib/haptics';
import {
  deriveStatusKey,
  statusColorClass,
  statusDotClass,
  statusLabel,
  relativeTime,
  prNumber,
} from '@lib/session-utils';
import type { SessionMessage } from '@api/devin/types';

type Tab = 'timeline' | 'worklog' | 'changes';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('timeline');
  const [messageText, setMessageText] = useState('');

  const validId = id && isValidSessionId(id) ? id : undefined;
  const { data: session, isLoading, error } = useSession(validId);
  const { data: messages } = useMessages(validId);
  const sendMessage = useSendMessage(validId);

  if (!validId) {
    return (
      <SafeAreaView className="flex-1 bg-surface0 items-center justify-center" edges={['top']}>
        <Text className="text-failed text-text14">Invalid session ID</Text>
        <Pressable className="mt-4" onPress={() => router.back()}>
          <Text className="text-brand text-text14">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Text className="text-brand text-text14">{'\u2190 Back'}</Text>
          </Pressable>
        </View>
        <SessionDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Text className="text-brand text-text14">{'\u2190 Back'}</Text>
          </Pressable>
        </View>
        <ErrorState
          title="Could not load session"
          message={error?.message ?? 'Unknown error'}
          onRetry={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const statusKey = deriveStatusKey(session);
  const colorClass = statusColorClass(statusKey);
  const dotClass = statusDotClass(statusKey);
  const label = statusLabel(session);
  const isActive = session.status === 'running' || session.status === 'new' || session.status === 'claimed';

  function handleSend() {
    if (!messageText.trim()) return;
    hapticLight();
    sendMessage.mutate(
      { message: messageText.trim() },
      {
        onSuccess: () => hapticSuccess(),
        onError: () => hapticError(),
      },
    );
    setMessageText('');
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-border-subtle">
        <View className="flex-row items-center mb-2">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Text className="text-brand text-text14">{'\u2190 Back'}</Text>
          </Pressable>
          <View className={`w-2 h-2 rounded-full mr-2 ${dotClass}`} />
          <Text className={`text-text13 ${colorClass}`}>{label}</Text>
          <Text className="text-text-low text-text12 ml-auto">{relativeTime(session.updated_at)}</Text>
        </View>
        <Text className="text-text-hi text-text17 mb-1">{session.title || 'Untitled session'}</Text>
        <View className="flex-row items-center">
          <Text className="text-text-low text-text12">{session.session_id}</Text>
          <Text className="text-text-low text-text12 ml-3">{session.acus_consumed} ACU</Text>
          {session.origin && (
            <Text className="text-text-low text-text12 ml-3 capitalize">{session.origin}</Text>
          )}
        </View>
        {/* PR badges */}
        {session.pull_requests.length > 0 && (
          <View className="flex-row mt-2">
            {session.pull_requests.map((pr, i) => (
              <Pressable
                key={i}
                className="bg-tint-green rounded-chip px-pillX py-pillY mr-2"
                onPress={() => pr.pr_url && Linking.openURL(pr.pr_url)}
              >
                <Text className="text-finished text-text12 font-medium">
                  #{prNumber(pr.pr_url)} {pr.state === 'merged' ? '(merged)' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {/* Tags */}
        {session.tags.length > 0 && (
          <View className="flex-row mt-2">
            {session.tags.map((tag) => (
              <View key={tag} className="bg-tint-secondary rounded-chip px-pillX py-pillY mr-1">
                <Text className="text-text-low text-text11">{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View className="flex-row border-b border-border-subtle">
        {([
          { key: 'timeline' as const, label: 'Timeline' },
          { key: 'worklog' as const, label: 'Worklog' },
          { key: 'changes' as const, label: 'Changes' },
        ]).map(({ key, label: tabLabel }) => (
          <Pressable
            key={key}
            className={`flex-1 py-3 items-center ${tab === key ? 'border-b-2 border-brand' : ''}`}
            onPress={() => setTab(key)}
          >
            <Text className={`text-text14 ${tab === key ? 'text-brand font-medium' : 'text-text-mid'}`}>
              {tabLabel}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      <View className="flex-1">
        {tab === 'timeline' && (
          <TimelineTab messages={messages ?? []} isLoading={isLoading} />
        )}
        {tab === 'worklog' && (
          <WorklogTab session={session} />
        )}
        {tab === 'changes' && (
          <ChangesTab session={session} />
        )}
      </View>

      {/* Message steering bar (only for active sessions) */}
      {isActive && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-row items-center bg-surface1 border-t border-border-subtle px-3 py-2">
            <TextInput
              className="flex-1 bg-surface2 rounded-input px-3 py-2 text-text14 text-text-hi max-h-20"
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Send a message…"
              placeholderTextColor="#FFFFFF66"
              multiline
            />
            <Pressable
              className={`rounded-button px-4 py-2 ml-2 ${messageText.trim() && !sendMessage.isPending ? 'bg-brand' : 'bg-tint-secondary'}`}
              disabled={!messageText.trim() || sendMessage.isPending}
              onPress={handleSend}
            >
              {sendMessage.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className={`text-text14 font-medium ${messageText.trim() ? 'text-text-always-white' : 'text-text-low'}`}>
                  Send
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

/** Timeline tab — shows messages from Devin and user in chronological order. */
function TimelineTab({ messages, isLoading }: { messages: SessionMessage[]; isLoading: boolean }) {
  const listRef = useRef<FlatList<SessionMessage>>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive.
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  if (isLoading && messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-text-mid text-text14">Loading messages…</Text>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-text-mid text-text14">No messages yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      className="flex-1 px-4 py-3"
      data={messages}
      keyExtractor={(item) => item.event_id}
      renderItem={({ item }) => <MessageBubble message={item} />}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
    />
  );
}

function MessageBubble({ message }: { message: SessionMessage }) {
  const isUser = message.source === 'user';
  return (
    <View className={`mb-3 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View className={`rounded-card px-4 py-3 ${isUser ? 'bg-brand' : 'bg-surface1'}`}>
        <Text className={`text-text14 ${isUser ? 'text-text-always-white' : 'text-text-hi'}`}>
          {message.message}
        </Text>
      </View>
      <Text className={`text-text-low text-text11 mt-1 ${isUser ? 'text-right' : ''}`}>
        {isUser ? 'You' : 'Devin'} · {relativeTime(message.created_at)}
      </Text>
    </View>
  );
}

/** Worklog tab — shows session metadata, ACU consumption, timeline summary. */
function WorklogTab({ session }: { session: NonNullable<ReturnType<typeof useSession>['data']> }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Status', value: `${session.status} / ${session.status_detail ?? '—'}` },
    { label: 'Created', value: new Date(session.created_at * 1000).toLocaleString() },
    { label: 'Updated', value: new Date(session.updated_at * 1000).toLocaleString() },
    { label: 'ACU consumed', value: String(session.acus_consumed) },
    { label: 'Origin', value: session.origin ?? '—' },
    { label: 'Category', value: session.category ?? '—' },
    { label: 'Playbook', value: session.playbook_id ?? '—' },
    { label: 'Parent session', value: session.parent_session_id ?? '—' },
    { label: 'Service user', value: session.service_user_id ?? '—' },
  ];

  return (
    <ScrollView className="flex-1 px-4 py-3">
      <View className="bg-surface1 rounded-card px-4 py-3 mb-4">
        <Text className="text-text-low text-text12 font-medium uppercase mb-3">Session info</Text>
        {rows.map(({ label, value }) => (
          <View key={label} className="flex-row py-2 border-b border-border-subtle last:border-b-0">
            <Text className="text-text-mid text-text13 flex-1">{label}</Text>
            <Text className="text-text-hi text-text13 flex-1 text-right">{value}</Text>
          </View>
        ))}
      </View>
      {session.url && (
        <Pressable
          className="bg-surface1 rounded-card px-4 py-3 items-center"
          onPress={() => Linking.openURL(session.url)}
        >
          <Text className="text-link text-text14">Open in Devin web app →</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

/** Changes tab — shows PRs associated with the session. */
function ChangesTab({ session }: { session: NonNullable<ReturnType<typeof useSession>['data']> }) {
  if (session.pull_requests.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-text-mid text-text14">No pull requests associated with this session.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-3">
      {session.pull_requests.map((pr, i) => (
        <Pressable
          key={i}
          className="bg-surface1 rounded-card px-4 py-3 mb-3"
          onPress={() => pr.pr_url && Linking.openURL(pr.pr_url)}
        >
          <View className="flex-row items-center mb-2">
            <View className={`rounded-chip px-pillX py-pillY mr-2 ${pr.state === 'merged' ? 'bg-tint-purple' : 'bg-tint-green'}`}>
              <Text className={`text-text12 font-medium ${pr.state === 'merged' ? 'text-merged' : 'text-finished'}`}>
                {pr.state ?? 'open'}
              </Text>
            </View>
            <Text className="text-text-hi text-text14 font-medium">#{prNumber(pr.pr_url)}</Text>
          </View>
          <Text className="text-text-mid text-text13" numberOfLines={2}>
            {pr.pr_url}
          </Text>
          {pr.merged_at && (
            <Text className="text-text-low text-text12 mt-1">Merged {relativeTime(pr.merged_at)}</Text>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}
