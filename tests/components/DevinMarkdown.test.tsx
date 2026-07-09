/**
 * Smoke test for the markdown renderer — renders code/lists/links without
 * throwing and surfaces the text content.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import { render } from '@testing-library/react-native';
import { DevinMarkdown } from '../../src/components/DevinMarkdown';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

describe('DevinMarkdown', () => {
  it('renders markdown content (code, list) without crashing', () => {
    const md = '# Title\n\nSome **bold** text.\n\n- item one\n- item two\n\n`inline code`';
    const { getByText } = render(
      <ThemeProvider>
        <DevinMarkdown>{md}</DevinMarkdown>
      </ThemeProvider>,
    );
    expect(getByText('Title')).toBeTruthy();
    expect(getByText('item one')).toBeTruthy();
  });
});

import { isVideoUrl, isAudioUrl } from '../../src/components/InlineMedia';

describe('media URL detection', () => {
  it('detects video and audio extensions (with query strings)', () => {
    expect(isVideoUrl('https://x.com/a.mp4')).toBe(true);
    expect(isVideoUrl('https://x.com/a.mov?t=1')).toBe(true);
    expect(isAudioUrl('https://x.com/a.mp3')).toBe(true);
    expect(isAudioUrl('https://x.com/a.m4a#frag')).toBe(true);
    expect(isVideoUrl('https://x.com/a.png')).toBe(false);
    expect(isAudioUrl('https://x.com/a.png')).toBe(false);
  });
});
