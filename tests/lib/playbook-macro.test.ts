import {
  normalizePlaybookMacro,
  validatePlaybookMacro,
} from '../../src/lib/playbook-macro';

describe('playbook macros', () => {
  it('normalizes blank macros to null', () => {
    expect(normalizePlaybookMacro('   ')).toBeNull();
    expect(normalizePlaybookMacro(' !release-check ')).toBe('!release-check');
  });

  it('accepts documented command characters', () => {
    expect(validatePlaybookMacro('!release_check-2')).toBeNull();
  });

  it('rejects missing prefixes, spaces, and punctuation', () => {
    expect(validatePlaybookMacro('release')).toMatch(/start with !/);
    expect(validatePlaybookMacro('!release check')).toMatch(/only letters/);
    expect(validatePlaybookMacro('!release/check')).toMatch(/only letters/);
  });
});
