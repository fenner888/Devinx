import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const homeSource = readFileSync(
  resolve(__dirname, '..', '..', 'src/app/(main)/index.tsx'),
  'utf8',
);

describe('Local-only Home', () => {
  it('offers no Cloud destination or Cloud session APIs', () => {
    expect(homeSource).not.toMatch(/Cloud|useSessions|usePlaybooks|useRepositories|useUploadAttachment/);
    expect(homeSource).toContain("type Picker = 'computer' | 'workspace' | 'model' | 'variant' | null");
    expect(homeSource).toContain('computers.length > 1');
    expect(homeSource).toContain('useComputerCreateOptions');
  });
});
