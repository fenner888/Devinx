import { z } from 'zod';

export const environmentAssistantInputSchema = z
  .object({
    repositoryPath: z.string().trim().min(1).max(500),
    runtimesAndTools: z.string().trim().min(1).max(2_000),
    bootstrap: z.string().trim().max(4_000),
    validation: z.string().trim().max(4_000),
    constraints: z.string().trim().max(4_000),
  })
  .strict();

export type EnvironmentAssistantInput = z.infer<typeof environmentAssistantInputSchema>;

function section(label: string, value: string, fallback: string): string {
  return `## ${label}\n${value.trim() || fallback}`;
}

/**
 * Builds a transparent, previewable Cloud session prompt. This does not call
 * private environment/snapshot endpoints and never claims that a snapshot was changed.
 */
export function buildEnvironmentAssistantPrompt(raw: EnvironmentAssistantInput): string {
  const input = environmentAssistantInputSchema.parse(raw);
  return [
    `Help configure and verify the Devin Cloud development environment for ${input.repositoryPath}.`,
    '',
    'First inspect the repository and the current environment. Do not expose or print secret values. Explain what is already available, what is missing, and whether each requested change can be made safely through the supported Devin environment workflow.',
    '',
    section('Required runtimes and tools', input.runtimesAndTools, 'Use the repository defaults.'),
    '',
    section(
      'Dependency and bootstrap steps',
      input.bootstrap,
      'Infer safe steps from repository documentation.',
    ),
    '',
    section(
      'Validation commands',
      input.validation,
      'Use the repository-defined lint, typecheck, test, and run commands.',
    ),
    '',
    section(
      'Constraints and non-goals',
      input.constraints,
      'Do not modify application behavior or production data.',
    ),
    '',
    'Deliver a concise environment report with: detected state, changes performed or recommended, validation results, and any manual organization-setting step still required. Never state that the active organization snapshot changed unless you can explicitly verify it.',
  ].join('\n');
}
