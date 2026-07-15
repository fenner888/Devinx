import type { RepositoryResponse } from '../../src/api/devin/types';
import { repositoryIndexPresentation } from '../../src/lib/repository-indexing';

function repository(indexing_status: RepositoryResponse['indexing_status']): RepositoryResponse {
  return {
    provider_repository_id: 'provider-1',
    git_connection_id: 'connection-1',
    git_connection_host: 'github.com',
    repo_name: 'DevinX',
    repo_path: 'fenner888/DevinX',
    repo_description: null,
    repo_language: 'TypeScript',
    last_updated_at: null,
    indexing_status,
  };
}

describe('repositoryIndexPresentation', () => {
  it('does not infer indexing when the API omits status', () => {
    expect(repositoryIndexPresentation(repository(undefined))).toEqual({
      indexed: false,
      label: 'Not indexed',
    });
  });

  it('prioritizes completed Wiki evidence without exposing commits', () => {
    const result = repositoryIndexPresentation(
      repository({
        indexing_enabled: true,
        latest_completed_wiki_index_job: {
          branch_name: 'main',
          commit: 'private-commit',
          created_at: '2026-07-12T12:00:00Z',
          job_id: 'private-job',
        },
      }),
    );
    expect(result.label).toBe('Wiki indexed');
    expect(result.detail).toContain('main');
    expect(result.detail).not.toContain('private-commit');
    expect(result.detail).not.toContain('private-job');
  });
});
