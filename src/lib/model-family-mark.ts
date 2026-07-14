export type ModelFamilyMarkKind =
  | 'adaptive'
  | 'claude'
  | 'glm'
  | 'swe'
  | 'gpt'
  | 'gemini'
  | 'deepseek'
  | 'grok'
  | 'kimi'
  | 'generic';

/**
 * Maps only recognizable provider/family names to presentation marks.
 * Model IDs still come exclusively from the live ACP catalog; this helper
 * never creates a selectable model or changes routing behavior.
 */
export function modelFamilyMarkKind(name: string | null | undefined): ModelFamilyMarkKind {
  const normalized = name?.trim().toLowerCase() ?? '';
  if (/^(adaptive|fusion)(\b|[-_])/.test(normalized)) return 'adaptive';
  if (/^claude(\b|[-_])/.test(normalized)) return 'claude';
  if (/^glm(\b|[-_])/.test(normalized)) return 'glm';
  if (/^swe(\b|[-_])/.test(normalized)) return 'swe';
  if (/^(gpt|openai)(\b|[-_])/.test(normalized)) return 'gpt';
  if (/^gemini(\b|[-_])/.test(normalized)) return 'gemini';
  if (/^deepseek(\b|[-_])/.test(normalized)) return 'deepseek';
  if (/^grok(\b|[-_])/.test(normalized)) return 'grok';
  if (/^(kimi|moonshot)(\b|[-_])/.test(normalized)) return 'kimi';
  return 'generic';
}
