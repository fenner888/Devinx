/**
 * Review — native Devin Review (v3 pr-reviews API).
 * Paste a PR URL, trigger a review, and watch its status live.
 */
import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePrReview, useTriggerPrReview } from '@api/devin/queries';
import { ApiError } from '@api/devin/client';
import { hapticLight, hapticSuccess, hapticError } from '@lib/haptics';
import { useTheme } from '@theme/index';
import type { PrReviewStatus } from '@api/devin/types';

const PR_URL_RE = /^https:\/\/[^\s/]+\/[^\s]+\/(pull|merge_requests|pull-requests)\/\d+/;

const STATUS_STYLE: Record<PrReviewStatus, { label: string; text: string; bg: string }> = {
  pending: { label: 'Pending', text: 'text-blocked', bg: 'bg-tint-orange' },
  running: { label: 'Running', text: 'text-brand-text', bg: 'bg-tint-blue' },
  completed: { label: 'Completed', text: 'text-finished', bg: 'bg-tint-green' },
  errored: { label: 'Errored', text: 'text-failed', bg: 'bg-tint-red' },
  cancelled: { label: 'Cancelled', text: 'text-text-mid', bg: 'bg-tint-secondary' },
};

export default function ReviewScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [prUrl, setPrUrl] = useState('');
  const [lookupUrl, setLookupUrl] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const review = usePrReview(lookupUrl);
  const trigger = useTriggerPrReview();

  const urlValid = PR_URL_RE.test(prUrl.trim());

  function handleTrigger() {
    const url = prUrl.trim();
    if (!urlValid || trigger.isPending) return;
    hapticLight();
    setTriggerError(null);
    trigger.mutate(url, {
      onSuccess: () => {
        hapticSuccess();
        setLookupUrl(url);
      },
      onError: (e) => {
        hapticError();
        setTriggerError(e instanceof Error ? e.message : 'Could not trigger review.');
      },
    });
  }

  function handleLookup() {
    const url = prUrl.trim();
    if (!urlValid) return;
    hapticLight();
    setTriggerError(null);
    if (url === lookupUrl) {
      review.refetch();
    } else {
      setLookupUrl(url);
    }
  }

  const isNotFound = review.error instanceof ApiError && review.error.code === 'not_found';

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <Text className="text-text-hi text-text17">Review</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <Text className="text-text-mid text-text13 mb-4">
            Devin reviews a pull request and leaves findings as PR comments. Paste a PR
            link to trigger a review or check the latest one.
          </Text>

          <Text className="text-text-low text-text12 font-medium uppercase mb-1">Pull request URL</Text>
          <TextInput
            className="bg-surface1 rounded-input px-3 py-3 text-text14 text-text-hi mb-2"
            value={prUrl}
            onChangeText={setPrUrl}
            placeholder="https://github.com/owner/repo/pull/123"
            placeholderTextColor={tokens.textLow.hex}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {prUrl.trim().length > 0 && !urlValid && (
            <Text className="text-text-low text-text12 mb-2">
              Enter a full PR/MR URL, e.g. https://github.com/owner/repo/pull/123
            </Text>
          )}

          <View className="flex-row gap-2 mb-4">
            <Pressable
              className={`flex-1 rounded-button py-3 items-center ${urlValid ? 'bg-brand' : 'bg-tint-secondary'}`}
              disabled={!urlValid || trigger.isPending}
              onPress={handleTrigger}
            >
              {trigger.isPending ? (
                <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
              ) : (
                <Text className={`text-text14 font-medium ${urlValid ? 'text-text-always-white' : 'text-text-low'}`}>
                  Trigger review
                </Text>
              )}
            </Pressable>
            <Pressable
              className={`flex-1 rounded-button py-3 items-center border ${urlValid ? 'border-border bg-tint-secondary' : 'border-border-subtle'}`}
              disabled={!urlValid}
              onPress={handleLookup}
            >
              <Text className={`text-text14 font-medium ${urlValid ? 'text-text-hi' : 'text-text-low'}`}>
                Check status
              </Text>
            </Pressable>
          </View>

          {triggerError && (
            <View className="flex-row items-start bg-tint-red rounded-card px-3 py-2 mb-4">
              <Ionicons name="alert-circle-outline" size={13} color={tokens.failed.hex} />
              <Text className="text-failed text-text12 ml-2 flex-1">{triggerError}</Text>
            </View>
          )}

          {/* Status card */}
          {lookupUrl && review.isLoading && (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={tokens.brand.hex} />
            </View>
          )}

          {lookupUrl && isNotFound && !review.data && (
            <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4">
              <Text className="text-text-hi text-text14 mb-1">No review yet</Text>
              <Text className="text-text-mid text-text13">
                This PR has no Devin Review on its current commit — trigger one above.
              </Text>
            </View>
          )}

          {lookupUrl && review.error && !isNotFound && !review.data && (
            <View className="flex-row items-start bg-tint-red rounded-card px-3 py-2">
              <Ionicons name="alert-circle-outline" size={13} color={tokens.failed.hex} />
              <Text className="text-failed text-text12 ml-2 flex-1">{review.error.message}</Text>
            </View>
          )}

          {review.data && review.error && (
            <View className="flex-row items-start bg-tint-orange rounded-card px-3 py-2 mb-3">
              <Ionicons name="alert-circle-outline" size={13} color={tokens.blocked.hex} />
              <Text className="text-blocked text-text12 ml-2 flex-1">
                Latest refresh failed — showing the last known status.
              </Text>
            </View>
          )}

          {review.data && (
            <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4">
              <View className="flex-row items-center mb-3">
                <View className={`rounded-chip px-pillX py-pillY ${STATUS_STYLE[review.data.status].bg}`}>
                  <Text className={`text-text12 font-medium ${STATUS_STYLE[review.data.status].text}`}>
                    {STATUS_STYLE[review.data.status].label}
                  </Text>
                </View>
                {(review.data.status === 'pending' || review.data.status === 'running') && (
                  <Text className="text-text-low text-text12 ml-2">refreshing every 10s…</Text>
                )}
              </View>
              {[
                { label: 'Repository', value: review.data.repo_path },
                { label: 'Pull request', value: `#${review.data.pr_number}` },
                { label: 'Commit', value: review.data.commit_sha.slice(0, 10) },
                { label: 'Accepted', value: new Date(review.data.created_at).toLocaleString() },
              ].map(({ label, value }, i, arr) => (
                <View key={label} className={`flex-row py-2 ${i < arr.length - 1 ? 'border-b border-border-subtle' : ''}`}>
                  <Text className="text-text-mid text-text13 flex-1">{label}</Text>
                  <Text className="text-text-hi text-text13">{value}</Text>
                </View>
              ))}
              {review.data.status === 'completed' && lookupUrl && (
                <Pressable
                  className="flex-row items-center justify-center mt-3 py-2"
                  onPress={() => Linking.openURL(lookupUrl)}
                >
                  <Text className="text-link text-text13">View findings on the PR →</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
