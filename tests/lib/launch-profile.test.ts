import { reconcileCloudResourceSelection } from '../../src/lib/launch-profile';

describe('reconcileCloudResourceSelection', () => {
  const selection = {
    repos: ['owner/kept', 'owner/deleted'],
    playbookId: 'deleted-playbook',
    knowledgeIds: ['kept-note', 'deleted-note'],
    secretIds: ['kept-secret', 'deleted-secret'],
  };

  it('removes references that are absent from loaded Cloud catalogs', () => {
    expect(
      reconcileCloudResourceSelection(selection, {
        repositoryPaths: ['owner/kept'],
        playbookIds: ['another-playbook'],
        knowledgeIds: ['kept-note'],
        secretIds: ['kept-secret'],
      }),
    ).toEqual({
      repos: ['owner/kept'],
      playbookId: null,
      knowledgeIds: ['kept-note'],
      secretIds: ['kept-secret'],
    });
  });

  it('does not clear a resource type before its catalog has loaded', () => {
    expect(reconcileCloudResourceSelection(selection, {})).toEqual(selection);
  });

  it('treats a loaded empty catalog as authoritative', () => {
    expect(
      reconcileCloudResourceSelection(selection, {
        repositoryPaths: [],
        playbookIds: [],
        knowledgeIds: [],
        secretIds: [],
      }),
    ).toEqual({ repos: [], playbookId: null, knowledgeIds: [], secretIds: [] });
  });
});
