import { render } from '@testing-library/react-native';

import { LiveActivityTrail } from '../../src/components/sessions/LiveActivityTrail';

describe('LiveActivityTrail', () => {
  it('keeps a bounded trail of real activity changes without claiming completion', () => {
    const { getByText, getAllByTestId, getByTestId, rerender } = render(
      <LiveActivityTrail active label="Reading project files" resetKey="session-1" />,
    );

    rerender(<LiveActivityTrail active label="Editing files" resetKey="session-1" />);

    expect(getByText('Reading project files')).toBeTruthy();
    expect(getByText('Editing files')).toBeTruthy();
    expect(getAllByTestId('session-live-activity-recent')).toHaveLength(1);
    expect(getByTestId('session-live-activity-current')).toBeTruthy();
  });

  it('clears the ephemeral trail when work settles or the session changes', () => {
    const { queryByTestId, getByText, queryByText, rerender } = render(
      <LiveActivityTrail active label="Running tests" resetKey="session-1" />,
    );

    rerender(<LiveActivityTrail active={false} label="Running tests" resetKey="session-1" />);
    expect(queryByTestId('session-live-activity')).toBeNull();

    rerender(<LiveActivityTrail active label="Writing a response" resetKey="session-2" />);
    expect(getByText('Writing a response')).toBeTruthy();
    expect(queryByText('Running tests')).toBeNull();
  });
});
