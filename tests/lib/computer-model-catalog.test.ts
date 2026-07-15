import {
  familyForModelId,
  groupComputerModels,
  preferredFamilyVariant,
  splitComputerModelName,
} from '../../src/lib/computer-model-catalog';

describe('Computer model catalog presentation', () => {
  it.each([
    ['GPT-5.6 Sol No Thinking Fast', 'GPT-5.6 Sol', 'None · Fast'],
    ['Claude Opus 4.8 XHigh', 'Claude Opus 4.8', 'XHigh'],
    ['Claude Opus 4.8 Medium Fast', 'Claude Opus 4.8', 'Medium · Fast'],
    ['GLM-5.2 No Thinking 1M', 'GLM-5.2', 'None · 1M'],
    ['Claude Sonnet 4.6 Thinking 1M', 'Claude Sonnet 4.6', 'Thinking · 1M'],
    ['SWE-1.7 Lightning', 'SWE-1.7', 'Lightning'],
    ['Gemini 3 Flash Minimal', 'Gemini 3 Flash', 'Minimal'],
    ['GPT-5.3-Codex X-High', 'GPT-5.3-Codex', 'XHigh'],
    ['DeepSeek V4 Pro', 'DeepSeek V4 Pro', 'Default'],
  ])('splits %s into a safe family and variant', (name, family, variant) => {
    expect(splitComputerModelName(name)).toEqual({ family, variant });
  });

  it('groups variants without changing their exact ACP model IDs', () => {
    const families = groupComputerModels([
      { id: 'adaptive', name: 'Adaptive', recommended: true },
      { id: 'gpt-low', name: 'GPT-5.6 Sol Low Thinking', recent: true },
      { id: 'gpt-high', name: 'GPT-5.6 Sol High Thinking', badge: 'new' as const },
      { id: 'gpt-fast', name: 'GPT-5.6 Sol High Thinking Fast' },
      { id: 'deepseek-v4', name: 'DeepSeek V4 Pro', badge: 'free_promo' as const },
    ]);

    expect(families).toEqual([
      {
        key: 'Adaptive',
        name: 'Adaptive',
        recent: false,
        recommended: true,
        variants: [{ label: 'Default', model: expect.objectContaining({ id: 'adaptive' }) }],
      },
      {
        key: 'GPT-5.6 Sol',
        name: 'GPT-5.6 Sol',
        badge: 'new',
        recent: true,
        recommended: false,
        variants: [
          { label: 'Low', model: expect.objectContaining({ id: 'gpt-low' }) },
          { label: 'High', model: expect.objectContaining({ id: 'gpt-high' }) },
          { label: 'High · Fast', model: expect.objectContaining({ id: 'gpt-fast' }) },
        ],
      },
      {
        key: 'DeepSeek V4 Pro',
        name: 'DeepSeek V4 Pro',
        badge: 'free_promo',
        recent: false,
        recommended: false,
        variants: [
          { label: 'Default', model: expect.objectContaining({ id: 'deepseek-v4' }) },
        ],
      },
    ]);
  });

  it('chooses only offered variants and preserves the current exact selection', () => {
    const families = groupComputerModels([
      { id: 'low', name: 'Grok 4.5 Low', recent: true },
      { id: 'high', name: 'Grok 4.5 High' },
      { id: 'adaptive', name: 'Adaptive', recommended: true },
    ]);
    const grok = familyForModelId(families, 'high');
    const recommended = familyForModelId(families, null);

    expect(grok?.name).toBe('Grok 4.5');
    expect(preferredFamilyVariant(grok!, 'high').model.id).toBe('high');
    expect(preferredFamilyVariant(grok!, null).model.id).toBe('low');
    expect(recommended?.name).toBe('Adaptive');
  });
});
