import { Text, View } from 'react-native';

import type { ComputerSessionActivity } from '@auth/computerBridge';

type TerminalQuestion = NonNullable<ComputerSessionActivity['terminalQuestion']>['questions'][number];

export function ComputerTerminalQuestionCard({
  question,
  computerName,
}: {
  question: TerminalQuestion;
  computerName: string;
}) {
  return (
    <View className="rounded-card border border-border bg-surface1 px-4 py-4">
      <Text className="text-text-hi text-text16 font-medium">{question.question}</Text>
      {question.header && (
        <View className="mt-2 self-start rounded-full bg-tint-secondary px-3 py-1">
          <Text className="text-text-mid text-text11">{question.header}</Text>
        </View>
      )}
      <View className="mt-3 flex-row flex-wrap gap-2">
        {question.options.map((option) => (
          <View
            className="min-h-10 justify-center rounded-full border border-border px-4 opacity-60"
            key={option}
            accessible
            accessibilityRole="text"
            accessibilityLabel={option}
            accessibilityState={{ disabled: true }}
          >
            <Text className="text-text-mid text-text13">{option}</Text>
          </View>
        ))}
      </View>
      <Text className="mt-3 text-text-low text-text12">
        Answer in Terminal on {computerName}
      </Text>
    </View>
  );
}
