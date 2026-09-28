import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import type { ComputerActivityEntry, ComputerActivityStatus } from '@auth/computerBridge';
import { DevinMarkdown } from '@components/DevinMarkdown';
import { activityStatusLabel } from '@lib/activity-labels';
import { useActivityExpansion } from '@store/activityExpansion';
import { fonts } from '@theme/tokens';
import { useTheme } from '@theme/index';

const MAXIMUM_DIFF_LINES = 400;

export function groupActivity(entries: ComputerActivityEntry[]): Map<number, ComputerActivityEntry[]> {
  const groups = new Map<number, ComputerActivityEntry[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.afterSequence);
    if (bucket) bucket.push(entry);
    else groups.set(entry.afterSequence, [entry]);
  }
  return groups;
}

function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${pluralForm ?? `${singular}s`}`;
}

export function summarizeActivity(entries: ComputerActivityEntry[]): string {
  const parts: string[] = [];
  if (entries.some((entry) => entry.kind === 'thought')) parts.push('Thought');
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== 'tool') continue;
    const kind = entry.toolKind ?? 'other';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const read = counts.get('read') ?? 0;
  if (read > 0) parts.push(`Read ${plural(read, 'file')}`);
  const edited = (counts.get('edit') ?? 0);
  if (edited > 0) parts.push(`Edited ${plural(edited, 'file')}`);
  const changed = (counts.get('delete') ?? 0) + (counts.get('move') ?? 0);
  if (changed > 0) parts.push(`Changed ${plural(changed, 'file')}`);
  const executed = counts.get('execute') ?? 0;
  if (executed > 0) parts.push(`Ran ${plural(executed, 'command')}`);
  const searched = counts.get('search') ?? 0;
  if (searched > 0) parts.push(searched > 1 ? `Searched ${searched} times` : 'Searched');
  const fetched = counts.get('fetch') ?? 0;
  if (fetched > 0) parts.push(`Fetched ${plural(fetched, 'page')}`);
  const others = (counts.get('think') ?? 0) + (counts.get('other') ?? 0);
  if (others > 0) parts.push(plural(others, 'step'));
  const started = entries
    .map((entry) => entry.startedAt)
    .filter((value): value is number => value !== undefined);
  const ended = entries
    .map((entry) => entry.endedAt)
    .filter((value): value is number => value !== undefined);
  if (started.length > 0 && ended.length > 0) {
    const seconds = Math.round((Math.max(...ended) - Math.min(...started)) / 1_000);
    if (seconds >= 1) parts.push(`${seconds}s`);
  }
  return parts.join(' · ') || 'Activity';
}

function groupStatus(entries: ComputerActivityEntry[]): ComputerActivityStatus | null {
  if (entries.some((entry) => entry.status === 'awaiting_input')) return 'awaiting_input';
  if (entries.some((entry) => entry.status === 'running')) return 'running';
  if (entries.some((entry) => entry.status === 'failed')) return 'failed';
  if (entries.some((entry) => entry.status === 'timed_out')) return 'timed_out';
  if (entries.some((entry) => entry.status === 'interrupted')) return 'interrupted';
  if (entries.some((entry) => entry.status === 'unknown')) return 'unknown';
  return null;
}

type IconName = NonNullable<ComponentProps<typeof Ionicons>['name']>;

const STEP_GLYPHS = {
  thought: 'sparkles-outline',
  read: 'document-text-outline',
  edit: 'create-outline',
  delete: 'trash-outline',
  move: 'swap-horizontal-outline',
  search: 'search-outline',
  execute: 'terminal-outline',
  fetch: 'globe-outline',
  think: 'ellipse-outline',
  other: 'ellipse-outline',
} as const satisfies Record<string, IconName>;

function stepGlyph(entry: ComputerActivityEntry): IconName {
  if (entry.kind === 'thought') return STEP_GLYPHS.thought;
  return STEP_GLYPHS[entry.toolKind ?? 'other'] ?? STEP_GLYPHS.other;
}

interface DiffLine {
  prefix: ' ' | '+' | '-';
  text: string;
}

function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  let head = 0;
  while (head < oldLines.length && head < newLines.length && oldLines[head] === newLines[head]) {
    head += 1;
  }
  let tail = 0;
  while (
    tail < oldLines.length - head &&
    tail < newLines.length - head &&
    oldLines[oldLines.length - 1 - tail] === newLines[newLines.length - 1 - tail]
  ) {
    tail += 1;
  }
  const lines: DiffLine[] = [];
  for (const text of oldLines.slice(0, head)) lines.push({ prefix: ' ', text });
  for (const text of oldLines.slice(head, oldLines.length - tail)) {
    lines.push({ prefix: '-', text });
  }
  for (const text of newLines.slice(head, newLines.length - tail)) {
    lines.push({ prefix: '+', text });
  }
  for (const text of oldLines.slice(oldLines.length - tail)) lines.push({ prefix: ' ', text });
  return lines;
}

function StepDetail({ entry }: { entry: ComputerActivityEntry }) {
  const [showAll, setShowAll] = useState(false);
  const detail = entry.detail;
  if (!detail) return null;
  if (detail.type === 'diff') {
    const lines = diffLines(detail.oldText ?? '', detail.newText ?? '');
    const visible = showAll ? lines : lines.slice(0, MAXIMUM_DIFF_LINES);
    return (
      <View className="mt-2 rounded-input bg-surface2 px-2 py-2" testID={`activity-detail-${entry.id}`}>
        {visible.map((line, index) => {
          const added = line.prefix === '+';
          const removed = line.prefix === '-';
          return (
            <Text
              key={`${index}:${line.prefix}`}
              className={`font-mono text-text12 ${
                added ? 'text-diff-added-text bg-diff-added-tint' : ''
              }${removed ? ' text-diff-removed-text bg-diff-removed-tint' : ''}${
                !added && !removed ? ' text-text-mid' : ''
              }`}
              testID={
                added
                  ? 'activity-diff-line-added'
                  : removed
                    ? 'activity-diff-line-removed'
                    : undefined
              }
            >
              {line.prefix} {line.text}
            </Text>
          );
        })}
        {lines.length > MAXIMUM_DIFF_LINES && !showAll && (
          <Pressable
            onPress={() => setShowAll(true)}
            accessibilityRole="button"
            accessibilityLabel={`Show all ${lines.length} diff lines`}
            className="mt-1"
          >
            <Text className="text-brand-text text-text12">
              Show more ({lines.length - MAXIMUM_DIFF_LINES} more lines)
            </Text>
          </Pressable>
        )}
        {entry.truncated && <Text className="mt-1 text-text-low text-text11">Trimmed</Text>}
      </View>
    );
  }
  if (entry.kind === 'thought') {
    return (
      <View className="mt-1" testID={`activity-detail-${entry.id}`}>
        <Text className="text-text-mid text-text12 italic">{detail.text}</Text>
        {entry.truncated && <Text className="mt-1 text-text-low text-text11">Trimmed</Text>}
      </View>
    );
  }
  return (
    <View
      className={`mt-2 rounded-input bg-surface2 px-2 py-2 ${showAll ? '' : 'max-h-60'}`}
      testID={`activity-detail-${entry.id}`}
    >
      <ScrollView nestedScrollEnabled>
        <Text
          className="font-mono text-text12 text-text-mid"
          style={{ fontFamily: fonts.mono }}
          selectable
        >
          {detail.text}
        </Text>
      </ScrollView>
      {!showAll && (
        <Pressable
          onPress={() => setShowAll(true)}
          accessibilityRole="button"
          accessibilityLabel={`Show full output for ${entry.title}`}
          className="mt-1"
        >
          <Text className="text-brand-text text-text12">Show more</Text>
        </Pressable>
      )}
      {entry.truncated && <Text className="mt-1 text-text-low text-text11">Trimmed</Text>}
    </View>
  );
}

function ActivityStep({
  bridgeId,
  sessionId,
  entry,
}: {
  bridgeId: string;
  sessionId: string;
  entry: ComputerActivityEntry;
}) {
  const { tokens } = useTheme();
  const expanded = useActivityExpansion((state) =>
    state.isExpanded(`${bridgeId}/${sessionId}/${entry.id}`, false),
  );
  const toggle = useActivityExpansion((state) => state.toggle);
  const statusLabel = activityStatusLabel(entry.status);
  const statusIsFinal = entry.status === 'completed';
  const paths = entry.paths ?? [];
  const shownPaths = paths.slice(0, 3);
  const hasDetail = entry.detail !== undefined;

  return (
    <View testID={`activity-step-${entry.id}`}>
      <Pressable
        className="flex-row items-start py-1"
        onPress={() => hasDetail && toggle(`${bridgeId}/${sessionId}/${entry.id}`)}
        disabled={!hasDetail}
        accessibilityRole={hasDetail ? 'button' : undefined}
        accessibilityLabel={`${entry.title}, ${statusLabel}`}
      >
        <Ionicons name={stepGlyph(entry)} size={13} color={tokens.textMid.hex} />
        <View className="ml-2 min-w-0 flex-1">
          <View className="flex-row items-center">
            <Text className="flex-1 text-text-hi text-text13" numberOfLines={2}>
              {entry.title}
            </Text>
            {!statusIsFinal && (
              <View className="ml-2 flex-row items-center">
                {entry.status === 'running' && (
                  <ActivityIndicator size="small" color={tokens.running.hex} />
                )}
                <Text
                  className={`ml-1 text-text11 ${
                    entry.status === 'failed'
                      ? 'text-failed'
                      : entry.status === 'awaiting_input'
                        ? 'text-brand-text'
                      : entry.status === 'running'
                        ? 'text-running'
                        : 'text-blocked'
                  }`}
                >
                  {statusLabel}
                </Text>
              </View>
            )}
          </View>
          {shownPaths.length > 0 && (
            <View className="mt-1 flex-row flex-wrap gap-1">
              {shownPaths.map((path) => (
                <Text
                  key={path}
                  className="rounded-inlineCode bg-tint-secondary px-1 py-px font-mono text-text11 text-text-mid"
                  style={{ fontFamily: fonts.mono }}
                  numberOfLines={1}
                >
                  {path}
                </Text>
              ))}
              {paths.length > shownPaths.length && (
                <Text className="text-text-low text-text11">+{paths.length - shownPaths.length}</Text>
              )}
            </View>
          )}
        </View>
      </Pressable>
      {hasDetail && expanded && <StepDetail entry={entry} />}
    </View>
  );
}

function PulsingDot() {
  const { tokens } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      className="mr-1.5 h-1.5 w-1.5 rounded-dot"
      style={{ backgroundColor: tokens.running.hex, opacity }}
    />
  );
}

export function ActivityGroup({
  bridgeId,
  sessionId,
  groupKey,
  entries,
  live = false,
  defaultExpanded,
  reply,
}: {
  bridgeId: string;
  sessionId: string;
  groupKey: string;
  entries: ComputerActivityEntry[];
  live?: boolean;
  defaultExpanded: boolean;
  reply?: string;
}) {
  const { tokens } = useTheme();
  const expanded = useActivityExpansion((state) =>
    state.isExpanded(`${bridgeId}/${sessionId}/${groupKey}`, defaultExpanded),
  );
  const toggle = useActivityExpansion((state) => state.toggle);
  const summary = summarizeActivity(entries);
  const status = groupStatus(entries);
  const statusLabel = status ? activityStatusLabel(status) : null;
  const dotColor =
    status === 'awaiting_input'
      ? tokens.brand.hex
      : status === 'failed'
      ? tokens.failed.hex
      : status === 'timed_out' || status === 'interrupted' || status === 'unknown'
        ? tokens.blocked.hex
        : status === 'running'
          ? tokens.running.hex
          : null;

  return (
    <View className="mb-4" testID={`activity-group-${groupKey}`}>
      <Pressable
        className="flex-row items-center py-1.5"
        onPress={() => toggle(`${bridgeId}/${sessionId}/${groupKey}`)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${summary}${statusLabel ? `, ${statusLabel}` : ''}`}
        testID={`activity-group-header-${groupKey}`}
      >
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={13}
          color={tokens.textLow.hex}
        />
        {status === 'running' ? (
          <PulsingDot />
        ) : dotColor ? (
          <View
            className="mr-1.5 h-1.5 w-1.5 rounded-dot"
            style={{ backgroundColor: dotColor }}
            testID="activity-group-status-dot"
          />
        ) : (
          <View className="w-3" />
        )}
        <Text className="flex-1 text-text-mid text-text12" numberOfLines={2}>
          {summary}
        </Text>
        {statusLabel && (
          <Text
            className={`ml-2 text-text11 ${
              status === 'failed'
                ? 'text-failed'
                : status === 'awaiting_input'
                  ? 'text-brand-text'
                : status === 'running'
                  ? 'text-running'
                  : 'text-blocked'
            }`}
          >
            {statusLabel}
          </Text>
        )}
      </Pressable>
      {expanded && (
        <View className="ml-1.5 border-l border-border-subtle pl-3">
          {entries.map((entry) => (
            <ActivityStep
              key={entry.id}
              bridgeId={bridgeId}
              sessionId={sessionId}
              entry={entry}
            />
          ))}
          {live && (
            <>
              {reply ? (
                <View className="mt-2">
                  <DevinMarkdown>{reply}</DevinMarkdown>
                </View>
              ) : null}
              <View className="mt-2 flex-row items-center">
                <ActivityIndicator size="small" color={tokens.running.hex} />
                <Text className="ml-2 text-text-low text-text12">Generating…</Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}
