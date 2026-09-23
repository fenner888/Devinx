import {
  buildEnvironmentAssistantPrompt,
  environmentAssistantInputSchema,
} from '../../src/lib/environment-assistant';

describe('environment assistant', () => {
  it('builds a transparent normal-session prompt without claiming a snapshot changed', () => {
    const prompt = buildEnvironmentAssistantPrompt({
      repositoryPath: 'owner/repo',
      runtimesAndTools: 'Node.js 24',
      bootstrap: 'npm ci',
      validation: 'npm run ci',
      constraints: 'Do not touch production data.',
    });

    expect(prompt).toContain('owner/repo');
    expect(prompt).toContain('Node.js 24');
    expect(prompt).toContain('npm ci');
    expect(prompt).toContain('npm run ci');
    expect(prompt).toContain('Do not expose or print secret values');
    expect(prompt).toContain('Never state that the active organization snapshot changed');
  });

  it('rejects missing repositories, tools, extra fields, and oversized input', () => {
    expect(
      environmentAssistantInputSchema.safeParse({
        repositoryPath: '',
        runtimesAndTools: '',
        bootstrap: '',
        validation: '',
        constraints: '',
      }).success,
    ).toBe(false);
    expect(
      environmentAssistantInputSchema.safeParse({
        repositoryPath: 'owner/repo',
        runtimesAndTools: 'Node.js',
        bootstrap: '',
        validation: '',
        constraints: '',
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      environmentAssistantInputSchema.safeParse({
        repositoryPath: 'owner/repo',
        runtimesAndTools: 'x'.repeat(2_001),
        bootstrap: '',
        validation: '',
        constraints: '',
      }).success,
    ).toBe(false);
  });
});
