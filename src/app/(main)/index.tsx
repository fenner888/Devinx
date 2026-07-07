/**
 * Session Board — spec §7.2 (minimal for Session 1).
 * Reads the real session list via useSessions hook.
 * Blocked-first sorting (parity-delta #1), status chips with exact labels,
 * pull-to-refresh, FAB for new session.
 *
 * Full features (filters, search, long-press menu, sections) ship in Session 2.
 */
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSessions } from '@api/devin/queries';
import { statusLabels, type StatusLabelKey } from '@theme/tokens';
import type { SessionResponse } from '@api/devin/types';

/** Derive the status label key from a session (mirrors web app state machine). */
function deriveStatusKey(s: SessionResponse): StatusLabelKey {
  if (s.status === 'error') return 'crashed';
  if (s.status === 'exit') {
    if (s.status_detail === 'finished') {
      if (s.pull_requests.length > 0) {
        const pr = s.pull_requests[0];
        if (pr?.state === 'merged' || pr?.merged_at) return 'done';
        return 'prReady';
      }
      return 'done';
    }
    return 'closed';
  }
  if (s.status === 'suspended') {
    if (s.status_detail === 'usage_limit_exceeded') return 'exceededLimit';
    if (s.status_detail === 'inactivity') return 'sleeping';
    return 'sleeping';
  }
  if (s.status_detail === 'waiting_for_user') return 'waitingForResponse';
  if (s.status_detail === 'waiting_for_approval') return 'approvalRequired';
  if (s.status_detail === 'finished') return 'done';
  return 'working';
}

/** Blocked-first sort (parity-delta #1). */
function sortSessions(sessions: SessionResponse[]): SessionResponse[] {
  const priority = (s: SessionResponse): number => {
    const key = deriveStatusKey(s);
    if (key === 'waitingForResponse' || key === 'approvalRequired' || key === 'exceededLimit') return 0;
    if (key === 'working' || key === 'settingUp' || key === 'planning' || key === 'coding' || key === 'iterating' || key === 'testing') return 1;
    if (key === 'prReady' || key === 'prReadyWaitingCI' || key === 'waitingForCI' || key === 'reviewPR') return 2;
    if (key === 'done' || key === 'closed' || key === 'crashed') return 3;
    return 4; // sleeping
  };
  return [...sessions].sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    return b.updated_at - a.updated_at;
  });
}

function statusColor(key: StatusLabelKey): string {
  if (key === 'crashed') return 'text-failed';
  if (key === 'waitingForResponse' || key === 'approvalRequired' || key === 'exceededLimit') return 'text-blocked';
  if (key === 'prReady' || key === 'prReadyWaitingCI' || key === 'waitingForCI' || key === 'reviewPR' || key === 'done') return 'text-finished';
  if (key === 'sleeping' || key === 'closed') return 'text-text-mid';
  return 'text-brand';
}

function SessionRow({ session, onPress }: { session: SessionResponse; onPress: () => void }) {
  const key = deriveStatusKey(session);
  const label = statusLabels[key];
  const colorClass = statusColor(key);

  return (
    <Pressable
      className="flex-row items-center bg-surface1 rounded-card px-4 py-3 mb-2"
      onPress={onPress}
    >
      {/* Status dot */}
      <View className={`w-2 h-2 rounded-full mr-3 ${colorClass.replace('text-', 'bg-')}`} />
      <View className="flex-1 min-w-0">
        <Text className="text-text-hi text-text14" numberOfLines={1}>
          {session.title || 'Untitled session'}
        </Text>
        <Text className={`text-text13 ${colorClass}`}>{label}</Text>
      </View>
      {session.pull_requests.length > 0 && (
        <View className="bg-tint-green rounded-chip px-pillX py-pillY ml-2">
          <Text className="text-finished text-text12 font-medium">
            #{session.pull_requests[0]?.pr_url?.split('/').pop() || 'PR'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function BoardScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useSessions('board');

  const sessions = data ? sortSessions(data) : [];

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <Text className="text-text-hi text-text17">Sessions</Text>
        <Pressable
          className="bg-brand rounded-button px-buttonSecondaryX py-2"
          onPress={() => router.push('/(main)/compose')}
        >
          <Text className="text-text-always-white text-text13 font-medium">+ New</Text>
        </Pressable>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-mid text-text14">Loading sessions…</Text>
        </View>
      )}

      {error && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-failed text-text14 mb-2">Could not load sessions</Text>
          <Text className="text-text-mid text-text13 text-center">{error.message}</Text>
        </View>
      )}

      {!isLoading && !error && sessions.length === 0 && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-mono text-brand text-text14 mb-3">{'>_'}</Text>
          <Text className="text-text-mid text-text14 text-center">
            No sessions yet. Start a new one to see it here.
          </Text>
        </View>
      )}

      {!error && sessions.length > 0 && (
        <FlatList
          className="flex-1 px-4"
          data={sessions}
          keyExtractor={(item) => item.session_id}
          renderItem={({ item }) => (
            <SessionRow
              session={item}
              onPress={() => router.push(`/(main)/session/${item.session_id}`)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor="#4489FF"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
