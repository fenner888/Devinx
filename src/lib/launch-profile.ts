export interface CloudResourceSelection {
  repos: string[];
  playbookId: string | null;
  knowledgeIds: string[];
  secretIds: string[];
}
export interface CloudResourceCatalog {
  repositoryPaths?: readonly string[];
  playbookIds?: readonly string[];
  knowledgeIds?: readonly string[];
  secretIds?: readonly string[];
}

/**
 * Removes references to Cloud resources that Devin no longer returns.
 * An undefined catalog means that resource type has not loaded yet and must
 * not be changed. An empty catalog is authoritative and clears the selection.
 */
export function reconcileCloudResourceSelection(
  selection: CloudResourceSelection,
  catalog: CloudResourceCatalog,
): CloudResourceSelection {
  const repositoryPaths = catalog.repositoryPaths
    ? new Set(catalog.repositoryPaths)
    : undefined;
  const playbookIds = catalog.playbookIds ? new Set(catalog.playbookIds) : undefined;
  const knowledgeIds = catalog.knowledgeIds ? new Set(catalog.knowledgeIds) : undefined;
  const secretIds = catalog.secretIds ? new Set(catalog.secretIds) : undefined;

  return {
    repos: repositoryPaths
      ? selection.repos.filter((repositoryPath) => repositoryPaths.has(repositoryPath))
      : selection.repos,
    playbookId:
      playbookIds && selection.playbookId && !playbookIds.has(selection.playbookId)
        ? null
        : selection.playbookId,
    knowledgeIds: knowledgeIds
      ? selection.knowledgeIds.filter((knowledgeId) => knowledgeIds.has(knowledgeId))
      : selection.knowledgeIds,
    secretIds: secretIds
      ? selection.secretIds.filter((secretId) => secretIds.has(secretId))
      : selection.secretIds,
  };
}
