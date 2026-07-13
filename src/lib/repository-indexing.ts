import type { RepositoryResponse } from '@api/devin/types';

export interface RepositoryIndexPresentation {
  detail?: string;
  indexed: boolean;
  label: 'Not indexed' | 'Indexing enabled' | 'Search indexed' | 'Wiki indexed';
}

function formatIndexDate(value: number | string): string | undefined {
  const date = new Date(typeof value === 'number' ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString();
}

export function repositoryIndexPresentation(
  repository: RepositoryResponse,
): RepositoryIndexPresentation {
  const status = repository.indexing_status;
  if (!status?.indexing_enabled) return { indexed: false, label: 'Not indexed' };

  const wiki = status.latest_completed_wiki_index_job;
  const search = status.latest_completed_search_index_job;
  const latest = wiki ?? search ?? status.latest_indexes?.[0];
  const detailParts: string[] = [];
  if (latest?.branch_name) detailParts.push(latest.branch_name);
  if (latest?.created_at != null) {
    const date = formatIndexDate(latest.created_at);
    if (date) detailParts.push(date);
  }

  return {
    indexed: true,
    label: wiki ? 'Wiki indexed' : search ? 'Search indexed' : 'Indexing enabled',
    detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
  };
}
