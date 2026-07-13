import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useTheme } from '@theme/index';

const MAXIMUM_ACTIVITY_ENTRIES = 3;
const MAXIMUM_ACTIVITY_LABEL_LENGTH = 96;

type ActivityTrailState = {
  resetKey: string;
  labels: string[];
};

function cleanActivityLabel(label: string | undefined): string {
  const printable = label
    ? Array.from(label, (character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint < 32 || codePoint === 127 ? ' ' : character;
      }).join('')
    : '';
  const collapsed = printable.replace(/\s+/g, ' ').trim();
  if (!collapsed) return 'Working on the next step';
  return collapsed.length > MAXIMUM_ACTIVITY_LABEL_LENGTH
    ? `${collapsed.slice(0, MAXIMUM_ACTIVITY_LABEL_LENGTH - 1).trimEnd()}…`
    : collapsed;
}

export function LiveActivityTrail({
  active,
  label,
  resetKey,
}: {
  active: boolean;
  label?: string;
  resetKey: string;
}) {
  const { tokens } = useTheme();
  const currentLabel = useMemo(() => cleanActivityLabel(label), [label]);
  const [trail, setTrail] = useState<ActivityTrailState>({ resetKey, labels: [] });

  useEffect(() => {
    setTrail((previous) => {
      if (!active) {
        if (previous.resetKey === resetKey && previous.labels.length === 0) return previous;
        return { resetKey, labels: [] };
      }

      const previousLabels = previous.resetKey === resetKey ? previous.labels : [];
      if (previousLabels.at(-1) === currentLabel) {
        return previous.resetKey === resetKey ? previous : { resetKey, labels: previousLabels };
      }
      return {
        resetKey,
        labels: [...previousLabels, currentLabel].slice(-MAXIMUM_ACTIVITY_ENTRIES),
      };
    });
  }, [active, currentLabel, resetKey]);

  if (!active) return null;

  const visibleLabels =
    trail.resetKey === resetKey && trail.labels.length > 0 ? trail.labels : [currentLabel];

  return (
    <View
      className="mb-4 gap-2"
      testID="session-live-activity"
      accessible
      accessibilityLabel={`Live session activity: ${visibleLabels.join(', ')}`}
    >
      {visibleLabels.map((activityLabel, index) => {
        const isCurrent = index === visibleLabels.length - 1;
        return (
          <View
            key={`${index}-${activityLabel}`}
            className="min-h-5 flex-row items-center"
            testID={isCurrent ? 'session-live-activity-current' : 'session-live-activity-recent'}
          >
            {isCurrent ? (
              <ActivityIndicator size="small" color={tokens.brandText.hex} />
            ) : (
              <View
                className="h-2 w-2 rounded-full border"
                style={{ borderColor: tokens.textLow.hex }}
              />
            )}
            <Text
              className={
                isCurrent
                  ? 'ml-2 flex-1 text-text13 text-text-mid'
                  : 'ml-2 flex-1 text-text12 text-text-low'
              }
              numberOfLines={2}
            >
              {activityLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
