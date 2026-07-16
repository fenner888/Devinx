import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import type {
  ComputerElicitationInteraction,
  ComputerElicitationAnswer,
} from '@auth/computerBridge';
import { useTheme } from '@theme/index';

type DraftValue = string | boolean | string[];

interface ComputerElicitationCardProps {
  interaction: ComputerElicitationInteraction;
  pending: boolean;
  error?: string;
  onRespond(response: ComputerElicitationAnswer): void;
}

function initialAnswers(interaction: ComputerElicitationInteraction): Record<string, DraftValue> {
  return Object.fromEntries(
    interaction.fields.map((field) => {
      if (Array.isArray(field.defaultValue)) return [field.key, [...field.defaultValue]];
      if (typeof field.defaultValue === 'boolean') return [field.key, field.defaultValue];
      if (field.defaultValue !== undefined) return [field.key, String(field.defaultValue)];
      if (field.type === 'multi_select') return [field.key, []];
      return [field.key, ''];
    }),
  );
}

function answerContent(
  interaction: ComputerElicitationInteraction,
  answers: Record<string, DraftValue>,
): Record<string, string | number | boolean | string[]> | null {
  const content: Record<string, string | number | boolean | string[]> = {};
  for (const field of interaction.fields) {
    const answer = answers[field.key];
    if (field.type === 'boolean') {
      if (typeof answer !== 'boolean') {
        if (field.required) return null;
        continue;
      }
      content[field.key] = answer;
      continue;
    }
    if (field.type === 'multi_select') {
      const selections = Array.isArray(answer) ? answer : [];
      if (field.required && selections.length === 0) return null;
      if (field.minItems !== undefined && selections.length < field.minItems) return null;
      if (field.maxItems !== undefined && selections.length > field.maxItems) return null;
      if (selections.length > 0 || field.required) content[field.key] = selections;
      continue;
    }
    const text = typeof answer === 'string' ? answer.trim() : '';
    if (!text) {
      if (field.required) return null;
      continue;
    }
    if (field.minLength !== undefined && text.length < field.minLength) return null;
    if (field.maxLength !== undefined && text.length > field.maxLength) return null;
    if (field.type === 'number' || field.type === 'integer') {
      const numeric = Number(text);
      if (!Number.isFinite(numeric) || (field.type === 'integer' && !Number.isInteger(numeric))) {
        return null;
      }
      if (field.minimum !== undefined && numeric < field.minimum) return null;
      if (field.maximum !== undefined && numeric > field.maximum) return null;
      content[field.key] = numeric;
    } else {
      content[field.key] = text;
    }
  }
  return content;
}

export function ComputerElicitationCard({
  interaction,
  pending,
  error,
  onRespond,
}: ComputerElicitationCardProps) {
  const { tokens } = useTheme();
  const [answers, setAnswers] = useState<Record<string, DraftValue>>(() =>
    initialAnswers(interaction),
  );
  const content = useMemo(() => answerContent(interaction, answers), [answers, interaction]);

  useEffect(() => setAnswers(initialAnswers(interaction)), [interaction]);

  return (
    <View className="mb-5 rounded-card border border-brand bg-surface1 px-4 py-4">
      <Text className="text-brand-text text-text12 font-medium">Devin needs your input</Text>
      <Text className="mt-1 text-text-hi text-text16 font-medium">
        {interaction.title ?? interaction.message}
      </Text>
      {interaction.title && (
        <Text className="mt-2 text-text-mid text-text13 leading-5">{interaction.message}</Text>
      )}
      {interaction.description && (
        <Text className="mt-1 text-text-mid text-text12 leading-5">{interaction.description}</Text>
      )}

      {interaction.fields.map((field) => {
        const value = answers[field.key];
        const options = field.options ?? [];
        return (
          <View className="mt-4" key={field.key}>
            <Text className="text-text-hi text-text13 font-medium">
              {field.title}
              {field.required ? ' *' : ''}
            </Text>
            {field.description && (
              <Text className="mt-1 text-text-low text-text12">{field.description}</Text>
            )}
            {field.type === 'single_select' || field.type === 'boolean' ? (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {(field.type === 'boolean'
                  ? [
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' },
                    ]
                  : options
                ).map((option) => {
                  const selected =
                    field.type === 'boolean'
                      ? value === (option.value === 'true')
                      : value === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      className={`min-h-11 justify-center rounded-full border px-4 ${selected ? 'border-brand bg-tint-primary' : 'border-border bg-surface2'}`}
                      onPress={() =>
                        setAnswers((current) => ({
                          ...current,
                          [field.key]:
                            field.type === 'boolean' ? option.value === 'true' : option.value,
                        }))
                      }
                      disabled={pending}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: pending }}
                      accessibilityLabel={`${field.title}: ${option.label}`}
                    >
                      <Text
                        className={
                          selected ? 'text-brand-text text-text13' : 'text-text-mid text-text13'
                        }
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : field.type === 'multi_select' ? (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {options.map((option) => {
                  const selected = Array.isArray(value) && value.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      className={`min-h-11 justify-center rounded-full border px-4 ${selected ? 'border-brand bg-tint-primary' : 'border-border bg-surface2'}`}
                      onPress={() =>
                        setAnswers((current) => {
                          const existing = Array.isArray(current[field.key])
                            ? (current[field.key] as string[])
                            : [];
                          return {
                            ...current,
                            [field.key]: selected
                              ? existing.filter((item) => item !== option.value)
                              : [...existing, option.value],
                          };
                        })
                      }
                      disabled={pending}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled: pending }}
                      accessibilityLabel={`${field.title}: ${option.label}`}
                    >
                      <Text
                        className={
                          selected ? 'text-brand-text text-text13' : 'text-text-mid text-text13'
                        }
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <TextInput
                className="mt-2 min-h-12 rounded-card border border-border bg-surface2 px-3 py-3 text-text-hi text-text14"
                value={typeof value === 'string' ? value : ''}
                onChangeText={(text) =>
                  setAnswers((current) => ({ ...current, [field.key]: text }))
                }
                keyboardType={
                  field.type === 'number' || field.type === 'integer' ? 'numeric' : 'default'
                }
                multiline={field.type === 'text'}
                editable={!pending}
                placeholder={field.required ? 'Required' : 'Optional'}
                placeholderTextColor={tokens.textLow.hex}
                accessibilityLabel={field.title}
              />
            )}
          </View>
        );
      })}

      {error && <Text className="mt-3 text-failed text-text12">{error}</Text>}
      {!content && (
        <Text className="mt-3 text-text-low text-text12">
          Complete the required fields before answering.
        </Text>
      )}
      <View className="mt-4 flex-row justify-end gap-2">
        <Pressable
          className="min-h-11 justify-center rounded-full border border-border px-4"
          onPress={() => onRespond({ interactionId: interaction.id, action: 'decline' })}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel="Decline Devin question"
        >
          <Text className="text-text-mid text-text13">Decline</Text>
        </Pressable>
        <Pressable
          className={`min-h-11 min-w-24 items-center justify-center rounded-full px-4 ${content && !pending ? 'bg-brand' : 'bg-tint-secondary'}`}
          onPress={() =>
            content && onRespond({ interactionId: interaction.id, action: 'accept', content })
          }
          disabled={!content || pending}
          accessibilityRole="button"
          accessibilityLabel="Send answer to Devin"
          accessibilityState={{ disabled: !content || pending }}
        >
          {pending ? (
            <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
          ) : (
            <Text className="text-text-always-white text-text13 font-medium">Answer</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
