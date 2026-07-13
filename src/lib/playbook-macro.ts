const PLAYBOOK_MACRO_PATTERN = /^![A-Za-z0-9_-]+$/;

export function normalizePlaybookMacro(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function validatePlaybookMacro(value: string): string | null {
  const normalized = normalizePlaybookMacro(value);
  if (!normalized || PLAYBOOK_MACRO_PATTERN.test(normalized)) return null;
  return 'Macro must start with ! and contain only letters, numbers, underscores, or hyphens.';
}
