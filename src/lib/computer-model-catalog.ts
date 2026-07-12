export type ComputerModelBadge = 'new' | 'free_promo';

export interface ComputerModelCatalogItem {
  id: string;
  name: string;
  description?: string;
  supportsImages?: boolean;
  badge?: ComputerModelBadge;
  recent?: boolean;
  recommended?: boolean;
}

export interface ComputerModelVariant<T extends ComputerModelCatalogItem = ComputerModelCatalogItem> {
  label: string;
  model: T;
}

export interface ComputerModelFamily<T extends ComputerModelCatalogItem = ComputerModelCatalogItem> {
  key: string;
  name: string;
  description?: string;
  badge?: ComputerModelBadge;
  recent: boolean;
  recommended: boolean;
  variants: ComputerModelVariant<T>[];
}

function normalizeEffort(value: string): string {
  if (value === 'No') return 'None';
  if (value === 'X-High') return 'XHigh';
  return value;
}

export function splitComputerModelName(name: string): { family: string; variant: string } {
  const thinking = name.match(
    /^(.*) (No|Low|Medium|High|XHigh|X-High|Max) Thinking( Fast)?$/,
  );
  if (thinking) {
    return {
      family: thinking[1] ?? name,
      variant: `${normalizeEffort(thinking[2] ?? '')}${thinking[3] ? ' · Fast' : ''}`,
    };
  }

  const contextThinking = name.match(/^(.*?) (No Thinking|High|Max|Thinking) 1M$/);
  if (contextThinking) {
    return {
      family: contextThinking[1] ?? name,
      variant: `${contextThinking[2] === 'No Thinking' ? 'None' : contextThinking[2]} · 1M`,
    };
  }

  const contextOnly = name.match(/^(.*) 1M$/);
  if (contextOnly) return { family: contextOnly[1] ?? name, variant: '1M' };

  const thinkingOnly = name.match(/^(.*) Thinking$/);
  if (thinkingOnly) return { family: thinkingOnly[1] ?? name, variant: 'Thinking' };

  const speed = name.match(/^(SWE-[0-9]+(?:\.[0-9]+)?) (Fast|Lightning)$/);
  if (speed) return { family: speed[1] ?? name, variant: speed[2] ?? 'Fast' };

  const effort = name.match(/^(.*) (Minimal|Low|Medium|High|XHigh|X-High|Max)( Fast)?$/);
  if (effort) {
    return {
      family: effort[1] ?? name,
      variant: `${normalizeEffort(effort[2] ?? '')}${effort[3] ? ' · Fast' : ''}`,
    };
  }

  return { family: name, variant: 'Default' };
}

function familyBadge(models: ComputerModelCatalogItem[]): ComputerModelBadge | undefined {
  if (models.some((model) => model.badge === 'free_promo')) return 'free_promo';
  if (models.some((model) => model.badge === 'new')) return 'new';
  return undefined;
}

export function groupComputerModels<T extends ComputerModelCatalogItem>(
  models: T[],
): ComputerModelFamily<T>[] {
  const families = new Map<string, ComputerModelFamily<T>>();
  for (const model of models) {
    const presentation = splitComputerModelName(model.name);
    const existing = families.get(presentation.family);
    if (existing) {
      existing.variants.push({ label: presentation.variant, model });
      existing.recent ||= model.recent === true;
      existing.recommended ||= model.recommended === true;
      if (!existing.description && model.description) existing.description = model.description;
      existing.badge = familyBadge(existing.variants.map((variant) => variant.model));
      continue;
    }
    families.set(presentation.family, {
      key: presentation.family,
      name: presentation.family,
      ...(model.description ? { description: model.description } : {}),
      ...(model.badge ? { badge: model.badge } : {}),
      recent: model.recent === true,
      recommended: model.recommended === true,
      variants: [{ label: presentation.variant, model }],
    });
  }
  return [...families.values()];
}

export function familyForModelId<T extends ComputerModelCatalogItem>(
  families: ComputerModelFamily<T>[],
  modelId: string | null | undefined,
): ComputerModelFamily<T> | undefined {
  if (!modelId) return families.find((family) => family.recommended);
  return families.find((family) => family.variants.some((variant) => variant.model.id === modelId));
}

export function preferredFamilyVariant<T extends ComputerModelCatalogItem>(
  family: ComputerModelFamily<T>,
  currentModelId?: string | null,
): ComputerModelVariant<T> {
  return (
    family.variants.find((variant) => variant.model.id === currentModelId) ??
    family.variants.find((variant) => variant.model.recommended) ??
    family.variants.find((variant) => variant.model.recent) ??
    family.variants[0]
  ) as ComputerModelVariant<T>;
}
