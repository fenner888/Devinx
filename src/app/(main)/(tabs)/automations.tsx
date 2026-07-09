/**
 * Automations — native scheduled sessions (v3 schedules API).
 * List, create (cron presets or custom), enable/disable, delete.
 */
import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule } from '@api/devin/queries';
import { ErrorState, EmptyState } from '@components/Skeletons';
import { hapticLight, hapticSuccess, hapticError, hapticWarning } from '@lib/haptics';
import { confirmAction } from '@lib/confirm';
import { useTheme } from '@theme/index';
import type { ScheduleResponse } from '@api/devin/types';

const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: 'Daily 9am', cron: '0 9 * * *' },
  { label: 'Weekdays 9am', cron: '0 9 * * 1-5' },
  { label: 'Mondays 9am', cron: '0 9 * * 1' },
  { label: 'Hourly', cron: '0 * * * *' },
];

export default function AutomationsScreen() {
  const { tokens } = useTheme();
  const { data: schedules, isLoading, error, refetch, isRefetching } = useSchedules();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [cron, setCron] = useState('0 9 * * 1-5');
  const [agent, setAgent] = useState<'devin' | 'data_analyst'>('devin');
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleCreate() {
    if (!name.trim() || !prompt.trim() || !cron.trim() || createSchedule.isPending) return;
    setCreateError(null);
    createSchedule.mutate(
      { name: name.trim(), prompt: prompt.trim(), schedule_type: 'recurring', frequency: cron.trim(), agent },
      {
        onSuccess: () => {
          hapticSuccess();
          setShowCreate(false);
          setName('');
          setPrompt('');
        },
        onError: (e) => {
          hapticError();
          setCreateError(e instanceof Error ? e.message : 'Could not create schedule.');
        },
      },
    );
  }

  function handleToggle(schedule: ScheduleResponse) {
    // One in-flight mutation per row — a second tap during flight would
    // recompute from the same stale value and undo what the user sees.
    if (pendingId === schedule.schedule_id) return;
    hapticLight();
    setActionError(null);
    setPendingId(schedule.schedule_id);
    const target = !schedule.enabled;
    updateSchedule.mutate(
      { scheduleId: schedule.schedule_id, body: { enabled: target } },
      {
        onSettled: () => setPendingId(null),
        onError: (e) => {
          hapticError();
          setActionError(`Could not ${target ? 'enable' : 'disable'} "${schedule.name}": ${e.message}`);
        },
      },
    );
  }

  function handleDelete(schedule: ScheduleResponse) {
    hapticWarning();
    confirmAction(
      {
        title: 'Delete automation?',
        message: `"${schedule.name}" will stop running. This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      },
      () =>
        deleteSchedule.mutate(schedule.schedule_id, {
          onError: (e) => {
            hapticError();
            setActionError(`Could not delete "${schedule.name}": ${e.message}`);
          },
        }),
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Header — top-level tab, no back button */}
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <Text className="text-text-hi text-text24 flex-1">Automations</Text>
        <Pressable
          className="flex-row items-center bg-brand rounded-button px-3.5 py-2"
          onPress={() => setShowCreate(true)}
          accessibilityRole="button"
          accessibilityLabel="New automation"
        >
          <Ionicons name="add" size={16} color={tokens.textAlwaysWhite.hex} />
          <Text className="text-text-always-white text-text13 font-medium ml-1">New</Text>
        </Pressable>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.brand.hex} />
        </View>
      )}

      {error && !schedules && (
        <ErrorState
          title="Could not load automations"
          message={error.message}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && schedules && schedules.length === 0 && (
        <EmptyState
          icon=">_"
          title="No automations yet"
          message="Schedule Devin to run a prompt on a recurring cadence — daily standups, dependency checks, triage sweeps."
        />
      )}

      {schedules && schedules.length > 0 && (
        <ScrollView
          className="flex-1 px-4 py-3"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={tokens.brand.hex} />
          }
        >
          {actionError && (
            <View className="flex-row items-start bg-tint-red rounded-card px-3 py-2 mb-3">
              <Ionicons name="alert-circle-outline" size={13} color={tokens.failed.hex} />
              <Text className="text-failed text-text12 ml-2 flex-1">{actionError}</Text>
            </View>
          )}
          {schedules.map((s) => (
            <View key={s.schedule_id} className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-3 mb-3">
              <View className="flex-row items-center">
                <View className="flex-1 mr-3">
                  <Text className="text-text-hi text-text14 font-medium" numberOfLines={1}>{s.name}</Text>
                  <Text className="text-text-low text-text12 mt-0.5" numberOfLines={2}>{s.prompt}</Text>
                </View>
                {/* Enable toggle */}
                <Pressable
                  onPress={() => handleToggle(s)}
                  disabled={pendingId === s.schedule_id}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: s.enabled }}
                  accessibilityLabel={`${s.name} enabled`}
                >
                  {pendingId === s.schedule_id ? (
                    <View className="w-12 h-7 items-center justify-center">
                      <ActivityIndicator size="small" color={tokens.brand.hex} />
                    </View>
                  ) : (
                    <View className={`w-12 h-7 rounded-chip p-0.5 ${s.enabled ? 'bg-brand' : 'bg-tint-primary'}`}>
                      <View className={`w-6 h-6 rounded-chip bg-surface2 ${s.enabled ? 'ml-auto' : ''}`} />
                    </View>
                  )}
                </Pressable>
              </View>
              <View className="flex-row items-center mt-2">
                <Ionicons name="time-outline" size={12} color={tokens.textLow.hex} />
                <Text className="text-text-low text-text12 ml-1 flex-1">
                  {s.schedule_type === 'one_time'
                    ? `Once at ${s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : '—'}`
                    : `cron: ${s.frequency ?? '—'}`}
                  {s.last_executed_at ? ` · last run ${new Date(s.last_executed_at).toLocaleDateString()}` : ''}
                </Text>
                <Pressable
                  className="w-8 h-8 rounded-full items-center justify-center"
                  onPress={() => handleDelete(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${s.name}`}
                >
                  <Ionicons name="trash-outline" size={15} color={tokens.failed.hex} />
                </Pressable>
              </View>
              {s.last_error_message && (
                <View className="flex-row items-start bg-tint-red rounded-card px-3 py-2 mt-2">
                  <Ionicons name="alert-circle-outline" size={13} color={tokens.failed.hex} />
                  <Text className="text-failed text-text12 ml-2 flex-1" numberOfLines={2}>
                    {s.last_error_message}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create sheet */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-1 bg-scrim justify-end">
            <View className="bg-surface2 rounded-t-sheet px-5 py-4 max-h-[85%]">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-text-hi text-text17">New automation</Text>
                <Pressable
                  onPress={() => {
                    setShowCreate(false);
                    setCreateError(null);
                  }}
                >
                  <Ionicons name="close" size={18} color={tokens.textMid.hex} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="text-text-low text-text12 font-medium uppercase mb-1">Name</Text>
              <TextInput
                className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-3"
                value={name}
                onChangeText={setName}
                placeholder="Daily dependency check"
                placeholderTextColor={tokens.textLow.hex}
                maxLength={100}
              />

              <Text className="text-text-low text-text12 font-medium uppercase mb-1">Prompt</Text>
              <TextInput
                className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-3 min-h-20"
                value={prompt}
                onChangeText={setPrompt}
                placeholder="What should Devin do on each run?"
                placeholderTextColor={tokens.textLow.hex}
                multiline
                textAlignVertical="top"
              />

              <Text className="text-text-low text-text12 font-medium uppercase mb-1">Agent</Text>
              <View className="flex-row bg-tint-secondary rounded-button p-1 mb-3">
                {(
                  [
                    { key: 'devin', label: 'Devin' },
                    { key: 'data_analyst', label: 'Data Analyst' },
                  ] as const
                ).map(({ key, label }) => (
                  <Pressable
                    key={key}
                    className={`flex-1 rounded-button py-2 ${agent === key ? 'bg-surface1' : ''}`}
                    onPress={() => setAgent(key)}
                  >
                    <Text className={`text-center text-text13 ${agent === key ? 'text-text-hi font-medium' : 'text-text-mid'}`}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-text-low text-text12 font-medium uppercase mb-1">Schedule (cron, UTC)</Text>
              <View className="flex-row flex-wrap mb-2">
                {CRON_PRESETS.map((p) => (
                  <Pressable
                    key={p.cron}
                    className={`rounded-chip px-pillX py-pillY mr-2 mb-2 ${cron === p.cron ? 'bg-brand' : 'bg-tint-secondary'}`}
                    onPress={() => setCron(p.cron)}
                  >
                    <Text className={`text-text12 ${cron === p.cron ? 'text-text-always-white' : 'text-text-mid'}`}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi font-mono mb-3"
                value={cron}
                onChangeText={setCron}
                placeholder="0 9 * * 1-5"
                placeholderTextColor={tokens.textLow.hex}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {createError && (
                <View className="flex-row items-start bg-tint-red rounded-card px-3 py-2 mb-3">
                  <Ionicons name="alert-circle-outline" size={13} color={tokens.failed.hex} />
                  <Text className="text-failed text-text12 ml-2 flex-1">{createError}</Text>
                </View>
              )}

              <Pressable
                className={`rounded-button py-3 items-center mb-2 ${name.trim() && prompt.trim() && cron.trim() ? 'bg-brand' : 'bg-tint-secondary'}`}
                disabled={!name.trim() || !prompt.trim() || !cron.trim() || createSchedule.isPending}
                onPress={handleCreate}
              >
                {createSchedule.isPending ? (
                  <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
                ) : (
                  <Text className={`text-text14 font-medium ${name.trim() && prompt.trim() && cron.trim() ? 'text-text-always-white' : 'text-text-low'}`}>
                    Create automation
                  </Text>
                )}
              </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
