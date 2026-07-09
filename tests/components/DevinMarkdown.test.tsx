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
