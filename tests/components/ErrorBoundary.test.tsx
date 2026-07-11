import { render, screen } from '@testing-library/react-native';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

function CrashingChild(): React.JSX.Element {
  throw new Error('private prompt and credential-shaped details');
}

describe('ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('shows a safe fallback without rendering raw error details', () => {
    render(
      <ErrorBoundary>
        <CrashingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByText(/private prompt/)).toBeNull();
    expect(screen.queryByText('Error details')).toBeNull();
  });
});
