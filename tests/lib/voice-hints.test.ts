import { assembleVoiceHints } from '../../src/lib/voice/hints';

describe('voice vocabulary hints', () => {
  it('keeps useful project context in stable order without duplicates', () => {
    const hints = assembleVoiceHints({
      repositories: ['DevinX', 'edge-board'],
      playbooks: ['Security review'],
      tags: ['mobile', 'DevinX'],
    });
    expect(hints).toContain('edge-board');
    expect(hints).toContain('Security review');
    expect(hints).toContain('mobile');
    expect(hints.filter((hint) => hint.toLowerCase() === 'devinx')).toHaveLength(1);
  });

  it('excludes secret-shaped and opaque values', () => {
    const hints = assembleVoiceHints({
      repositories: ['api_key_prod', 'sk-abcdefghijklmnopqrstuvwxyz', 'normal-repo'],
      playbooks: ['password rotation'],
      tags: ['abcdefghijklmnopqrstuvwxyz123456'],
    });
    expect(hints).toContain('normal-repo');
    expect(hints.join(' ')).not.toMatch(/api_key|password|sk-abcdefghijklmnopqrstuvwxyz/);
    expect(hints).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
  });

  it('enforces native-module count and character caps', () => {
    const hints = assembleVoiceHints({
      repositories: Array.from({ length: 100 }, (_, index) => `repo-${index}`),
      playbooks: Array.from({ length: 100 }, (_, index) => `playbook-${index}`),
      tags: Array.from({ length: 100 }, (_, index) => `tag-${index}`),
    });
    expect(hints.length).toBeLessThanOrEqual(64);
    expect(hints.reduce((total, hint) => total + hint.length, 0)).toBeLessThanOrEqual(1_000);
  });
});
