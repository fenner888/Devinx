import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ModelFamilyMark } from '@components/sessions/ModelFamilyMark';
import {
  ModelCostIndicator,
  modelCostLabel,
} from '@components/sessions/ModelCostIndicator';
import {
  groupComputerModels,
  preferredFamilyVariant,
  type ComputerModelCatalogItem,
  type ComputerModelFamily,
} from '@lib/computer-model-catalog';
import { useTheme } from '@theme/index';

interface ComputerModelPickerSheetsProps {
  models: ComputerModelCatalogItem[];
  selectedModelId: string | null;
  modelVisible: boolean;
  variantVisible: boolean;
  onSelect: (modelId: string) => void;
  onCloseModel: () => void;
  onCloseVariant: () => void;
  catalogSource?: 'live' | 'recent';
  onRefresh?: () => Promise<unknown> | void;
  refreshing?: boolean;
  refreshError?: boolean;
}

export function ComputerModelPickerSheets({
  models,
  selectedModelId,
  modelVisible,
  variantVisible,
  onSelect,
  onCloseModel,
  onCloseVariant,
  catalogSource,
  onRefresh,
  refreshing = false,
  refreshError = false,
}: ComputerModelPickerSheetsProps) {
  const { height } = useWindowDimensions();
  const { tokens } = useTheme();
  const [query, setQuery] = useState('');
  const refreshedForOpen = useRef(false);
  const families = useMemo(() => groupComputerModels(models), [models]);
  const selectedFamily = families.find((family) =>
    family.variants.some((variant) => variant.model.id === selectedModelId),
  );
  const recommended = families.find((family) => family.recommended);
  const recent = families.filter(
    (family) => family.recent && family.key !== recommended?.key,
  );
  const others = families.filter(
    (family) => !family.recent && family.key !== recommended?.key,
  );
  const normalizedQuery = query.trim().toLowerCase();
  const results = families.filter(
    (family) =>
      family.name.toLowerCase().includes(normalizedQuery) ||
      family.description?.toLowerCase().includes(normalizedQuery) ||
      family.variants.some(
        (variant) =>
          variant.label.toLowerCase().includes(normalizedQuery) ||
          variant.model.name.toLowerCase().includes(normalizedQuery),
      ),
  );

  useEffect(() => {
    if (!modelVisible) {
      refreshedForOpen.current = false;
      return;
    }
    setQuery('');
    if (!refreshedForOpen.current && onRefresh) {
      refreshedForOpen.current = true;
      Promise.resolve(onRefresh()).catch(() => undefined);
    }
  }, [modelVisible, onRefresh]);

  function familyRow(family: ComputerModelFamily) {
    const selected = family.key === selectedFamily?.key;
    const presentedModel = preferredFamilyVariant(family, selectedModelId).model;
    const badge = family.badge === 'free_promo' ? 'Free promo' : family.badge === 'new' ? 'New' : null;
    const costLabel = modelCostLabel(presentedModel.costTier, presentedModel.costSummary);
    return (
      <Pressable
        key={family.key}
        className="min-h-14 flex-row items-center px-2 py-2.5"
        onPress={() => {
          onSelect(preferredFamilyVariant(family, selectedModelId).model.id);
          onCloseModel();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Use model family ${family.name}${badge ? `, ${badge}` : ''}${costLabel ? `, ${costLabel}` : ''}`}
      >
        <View className="w-10 items-start">
          <ModelFamilyMark name={family.name} size={26} />
        </View>
        <View className="flex-1 pr-2">
          <View className="flex-row items-center">
            <Text className="shrink text-text-hi text-text16" numberOfLines={1}>
              {family.name}
            </Text>
            {badge && (
              <View
                className={`ml-2 rounded-chip px-2 py-0.5 ${family.badge === 'free_promo' ? 'bg-tint-green' : 'bg-tint-blue'}`}
              >
                <Text
                  className={`text-text11 font-medium ${family.badge === 'free_promo' ? 'text-finished' : 'text-brand-text'}`}
                >
                  {badge}
                </Text>
              </View>
            )}
          </View>
          {family.description && (
            <Text className="mt-0.5 text-text-low text-text12" numberOfLines={2}>
              {family.description}
            </Text>
          )}
        </View>
        {family.variants.some((variant) => variant.model.supportsImages) && (
          <Ionicons name="image-outline" size={15} color={tokens.textLow.hex} />
        )}
        <View className="ml-2">
          <ModelCostIndicator
            costTier={presentedModel.costTier}
            costSummary={presentedModel.costSummary}
          />
        </View>
        <View className="w-8 items-end">
          {selected && <Ionicons name="checkmark" size={21} color={tokens.textHi.hex} />}
        </View>
      </Pressable>
    );
  }

  return (
    <>
      <Modal
        statusBarTranslucent
        visible={modelVisible}
        animationType="fade"
        transparent
        onRequestClose={onCloseModel}
      >
        <View className="flex-1 items-center justify-center px-8">
          <Pressable
            className="absolute inset-0 bg-scrim"
            onPress={onCloseModel}
            accessibilityRole="button"
            accessibilityLabel="Close model picker"
          />
          <View
            className="w-full max-w-96 overflow-hidden rounded-sheet border border-border bg-surface2 px-5 py-4 shadow-2xl"
            style={{ maxHeight: Math.min(height * 0.7, 540) }}
            accessibilityViewIsModal
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-text-low text-text14 font-medium">Model</Text>
              <View className="flex-row items-center">
                {onRefresh && (
                  <Pressable
                    className="h-11 w-11 items-center justify-center rounded-full"
                    onPress={() => {
                      Promise.resolve(onRefresh()).catch(() => undefined);
                    }}
                    disabled={refreshing}
                    accessibilityRole="button"
                    accessibilityLabel="Refresh models from Devin"
                    accessibilityState={{ disabled: refreshing, busy: refreshing }}
                  >
                    {refreshing ? (
                      <ActivityIndicator size="small" color={tokens.brandText.hex} />
                    ) : (
                      <Ionicons name="refresh" size={18} color={tokens.brandText.hex} />
                    )}
                  </Pressable>
                )}
                <Pressable
                  className="h-11 w-11 items-center justify-center rounded-full"
                  onPress={onCloseModel}
                  accessibilityRole="button"
                  accessibilityLabel="Close model menu"
                >
                  <Ionicons name="close" size={18} color={tokens.textLow.hex} />
                </Pressable>
              </View>
            </View>
            {models.length > 8 && (
              <View className="mb-3 flex-row items-center rounded-input border border-border-subtle bg-surface1 px-3">
                <Ionicons name="search" size={16} color={tokens.textLow.hex} />
                <TextInput
                  className="ml-2 min-h-11 flex-1 text-text-hi text-text14"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search models"
                  placeholderTextColor={tokens.textLow.hex}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Search session models"
                />
              </View>
            )}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {normalizedQuery ? (
                <>
                  <Text className="px-10 pb-2 pt-1 text-text-low text-text13 font-medium">Results</Text>
                  {results.length > 0 ? (
                    results.map(familyRow)
                  ) : (
                    <Text className="px-10 py-5 text-text-low text-text14">No matching models</Text>
                  )}
                </>
              ) : (
                <>
                  {recommended && (
                    <>
                      <Text className="px-10 pb-2 pt-1 text-text-low text-text13 font-medium">Recommended</Text>
                      {familyRow(recommended)}
                    </>
                  )}
                  {recent.length > 0 && (
                    <>
                      <View className="my-2 h-px bg-border-subtle" />
                      <Text className="px-10 pb-2 pt-2 text-text-low text-text13 font-medium">Recent</Text>
                      {recent.map(familyRow)}
                    </>
                  )}
                  {others.length > 0 && (
                    <>
                      <View className="my-2 h-px bg-border-subtle" />
                      <Text className="px-10 pb-2 pt-2 text-text-low text-text13 font-medium">All Models</Text>
                      {others.map(familyRow)}
                    </>
                  )}
                  {catalogSource === 'recent' && (
                    <Text className="px-10 pb-3 pt-4 text-text-low text-text11">
                      Showing recent models. Refresh to load the full catalog from Devin.
                    </Text>
                  )}
                  {refreshError && (
                    <Text className="px-10 pb-3 pt-4 text-failed text-text11">
                      Couldn&apos;t refresh models. Your previous list is still available.
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        statusBarTranslucent
        visible={variantVisible}
        animationType="fade"
        transparent
        onRequestClose={onCloseVariant}
      >
        <View className="flex-1 items-center justify-center px-8">
          <Pressable
            className="absolute inset-0 bg-scrim"
            onPress={onCloseVariant}
            accessibilityRole="button"
            accessibilityLabel="Close reasoning and speed picker"
          />
          <View
            className="w-full max-w-96 overflow-hidden rounded-sheet border border-border bg-surface2 px-5 py-4 shadow-2xl"
            style={{ maxHeight: Math.min(height * 0.7, 540) }}
            accessibilityViewIsModal
          >
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-text-low text-text14 font-medium">Reasoning &amp; speed</Text>
                <Text className="mt-0.5 text-text-hi text-text16" numberOfLines={1}>
                  {selectedFamily?.name ?? 'Current model'}
                </Text>
              </View>
              <Pressable
                className="h-9 w-9 items-center justify-center rounded-full"
                onPress={onCloseVariant}
                accessibilityRole="button"
                accessibilityLabel="Close reasoning and speed menu"
              >
                <Ionicons name="close" size={18} color={tokens.textLow.hex} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedFamily?.variants.map((variant) => {
                const selected = variant.model.id === selectedModelId;
                const costLabel = modelCostLabel(
                  variant.model.costTier,
                  variant.model.costSummary,
                );
                return (
                  <Pressable
                    key={variant.model.id}
                    className="min-h-14 flex-row items-center px-2 py-3"
                    onPress={() => {
                      onSelect(variant.model.id);
                      onCloseVariant();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${variant.label} for ${selectedFamily.name}${costLabel ? `, ${costLabel}` : ''}`}
                  >
                    <View className="w-8 items-start">
                      {selected && <Ionicons name="checkmark" size={21} color={tokens.textHi.hex} />}
                    </View>
                    <Text className="flex-1 text-text-hi text-text16">{variant.label}</Text>
                    <ModelCostIndicator
                      costTier={variant.model.costTier}
                      costSummary={variant.model.costSummary}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
