import { modelFamilyMarkKind } from '../../src/lib/model-family-mark';

describe('model family presentation marks', () => {
  it.each([
    ['Adaptive', 'adaptive'],
    ['Fusion', 'adaptive'],
    ['Claude Opus 4.8', 'claude'],
    ['GLM-5.2', 'glm'],
    ['SWE-1.7', 'swe'],
    ['GPT-5.6 Sol', 'gpt'],
    ['Gemini 3 Flash', 'gemini'],
    ['DeepSeek V4 Pro', 'deepseek'],
    ['Grok 4.5', 'grok'],
    ['Future Model 1', 'generic'],
    [null, 'generic'],
  ])('maps %s to %s without changing the catalog', (name, expected) => {
    expect(modelFamilyMarkKind(name)).toBe(expected);
  });

  it('does not match lookalike names that only contain a provider word', () => {
    expect(modelFamilyMarkKind('Not Claude')).toBe('generic');
    expect(modelFamilyMarkKind('My SWE Tool')).toBe('generic');
  });
});
