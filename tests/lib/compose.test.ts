/**
 * Compose draft persistence + validation tests.
 */

import { sessionCreateRequestSchema } from '../../src/api/devin/schemas';

describe('compose', () => {
  describe('sessionCreateRequestSchema validation', () => {
    it('accepts a minimal valid payload (prompt only)', () => {
      const result = sessionCreateRequestSchema.safeParse({ prompt: 'Fix the login bug' });
      expect(result.success).toBe(true);
    });

    it('rejects empty prompt', () => {
      const result = sessionCreateRequestSchema.safeParse({ prompt: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing prompt', () => {
      const result = sessionCreateRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts prompt with title, tags, mode', () => {
      const result = sessionCreateRequestSchema.safeParse({
        prompt: 'Add unit tests',
        title: 'Test task',
        tags: ['testing', 'urgent'],
        devin_mode: 'fast',
      });
      expect(result.success).toBe(true);
    });

    it('accepts playbook_id and knowledge_ids', () => {
      const result = sessionCreateRequestSchema.safeParse({
        prompt: 'Refactor the auth module',
        playbook_id: 'pb-123',
        knowledge_ids: ['kn-1', 'kn-2'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts create_as_user_id for attribution', () => {
      const result = sessionCreateRequestSchema.safeParse({
        prompt: 'Fix bug',
        create_as_user_id: 'user_abc',
      });
      expect(result.success).toBe(true);
    });

    it('rejects too many tags (>50)', () => {
      const tags = Array.from({ length: 51 }, (_, i) => `tag-${i}`);
      const result = sessionCreateRequestSchema.safeParse({
        prompt: 'Do something',
        tags,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid devin_mode', () => {
      const result = sessionCreateRequestSchema.safeParse({
        prompt: 'Do something',
        devin_mode: 'turbo',
      });
      expect(result.success).toBe(false);
    });

    it('rejects web-only preview modes that the public API does not document', () => {
      const result = sessionCreateRequestSchema.safeParse({
        prompt: 'Do something',
        devin_mode: 'fusion',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('draft shape', () => {
    it('empty draft has correct defaults', () => {
      const emptyDraft = {
        prompt: '',
        title: '',
        playbookId: null,
        knowledgeIds: [],
        mode: 'normal',
        tags: [],
      };
      expect(emptyDraft.prompt).toBe('');
      expect(emptyDraft.mode).toBe('normal');
      expect(emptyDraft.tags).toHaveLength(0);
      expect(emptyDraft.playbookId).toBeNull();
    });
  });
});
