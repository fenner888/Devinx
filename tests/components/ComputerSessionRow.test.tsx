import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('../../src/theme/index', () => ({
  useTheme: () => ({
    tokens: {
      brandText: { hex: '#0088ff' },
      textMid: { hex: '#777777' },
      textLow: { hex: '#555555' },
    },
  }),
}));

import {
  ComputerDiscoveryNotices,
  ComputerListFreshness,
  ComputerSessionRow,
} from '../../src/components/sessions/ComputerSessionRow';

const SESSION = {
  id: `local_${'L'.repeat(43)}`,
  origin: 'computer' as const,
  workspaceName: 'DevinX',
  hasTitle: true,
  updatedAt: '2027-01-15T12:00:00.000Z',
  bridgeId: 'bridge_1234567890',
  computerName: 'Studio Mac',
  canLoad: false,
};

describe('Computer session presentation', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2027-01-15T13:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows origin and workspace without inventing or exposing a redacted title', () => {
    const screen = render(<ComputerSessionRow session={SESSION} />);

    expect(screen.getByText('DevinX')).toBeTruthy();
    expect(screen.getByText('Studio Mac')).toBeTruthy();
    expect(screen.getByText('Session title hidden')).toBeTruthy();
    expect(screen.getByText('1h ago')).toBeTruthy();
    expect(screen.queryByText('Untitled session')).toBeNull();
  });

  it('shows a title only when the bridge explicitly returns it', () => {
    const screen = render(
      <ComputerSessionRow session={{ ...SESSION, title: 'Review the release branch' }} />,
    );

    expect(screen.getByText('Review the release branch')).toBeTruthy();
    expect(screen.getByText('DevinX')).toBeTruthy();
    expect(screen.queryByText('Session title hidden')).toBeNull();
  });

  it('omits the computer name visually when requested but keeps it in the accessibility label', () => {
    const screen = render(<ComputerSessionRow session={SESSION} showComputerName={false} />);

    expect(screen.queryByText('Studio Mac')).toBeNull();
    expect(screen.getByLabelText(/on Studio Mac/)).toBeTruthy();
  });

  it('uses two title lines for regular rows and one for compact rows', () => {
    const session = { ...SESSION, title: 'Review the release branch' };
    const regularScreen = render(<ComputerSessionRow session={session} />);
    expect(regularScreen.getByText('Review the release branch').props.numberOfLines).toBe(2);
    regularScreen.unmount();

    const compactScreen = render(<ComputerSessionRow session={session} compact />);
    expect(compactScreen.getByText('Review the release branch').props.numberOfLines).toBe(1);
  });

  it('becomes a button only when an authorized history action is supplied', () => {
    const onPress = jest.fn();
    const screen = render(
      <ComputerSessionRow session={{ ...SESSION, canLoad: true }} onPress={onPress} />,
    );

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps ready computers quiet and explains safe degraded states', () => {
    const screen = render(
      <ComputerDiscoveryNotices
        computers={[
          { bridgeId: 'bridge_1234567890', computerName: 'Ready Mac', state: 'ready' },
          {
            bridgeId: 'bridge_0987654321',
            computerName: 'Pairing Mac',
            state: 'session_discovery_off',
          },
          {
            bridgeId: 'bridge_abcdefghij',
            computerName: 'Offline Mac',
            state: 'unavailable',
          },
        ]}
      />,
    );

    expect(screen.queryByText(/Ready Mac/)).toBeNull();
    expect(screen.getByText(/Pairing Mac is paired/)).toBeTruthy();
    expect(screen.getByText(/Offline Mac is offline/)).toBeTruthy();
  });

  it('shows a distinct busy notice instead of the offline notice', () => {
    const screen = render(
      <ComputerDiscoveryNotices
        computers={[
          { bridgeId: 'bridge_1234567890', computerName: 'Busy Mac', state: 'busy' },
        ]}
      />,
    );

    expect(
      screen.getByText(
        'Busy Mac is busy. Showing the last session list — pull to refresh again in a moment.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Busy Mac is offline/)).toBeNull();
  });

  it('explains when a local computer has more sessions than the bounded list can show', () => {
    const screen = render(
      <ComputerDiscoveryNotices
        computers={[
          {
            bridgeId: 'bridge_1234567890',
            computerName: 'Studio Mac',
            state: 'too_many_sessions',
          },
        ]}
      />,
    );

    expect(
      screen.getByText(
        'Studio Mac has more sessions than DevinX can list right now (250). Newer sessions may be missing.',
      ),
    ).toBeTruthy();
  });

  it('shows the freshness copy and returns null when the timestamp is undefined', () => {
    const fresh = render(
      <ComputerListFreshness lastSuccessfulAt={Date.parse('2027-01-15T13:00:00.000Z')} />,
    );
    expect(
      fresh.getByText('Local list updated just now · refreshes every 30s'),
    ).toBeTruthy();
    fresh.unmount();

    const missing = render(<ComputerListFreshness />);
    expect(missing.queryByText(/Local list updated/)).toBeNull();
  });

  it('updates relative freshness after a minute using its ticker', () => {
    jest.restoreAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2027-01-15T13:00:00.000Z'));

    const screen = render(<ComputerListFreshness lastSuccessfulAt={Date.now()} />);
    expect(
      screen.getByText('Local list updated just now · refreshes every 30s'),
    ).toBeTruthy();

    act(() => jest.advanceTimersByTime(60_000));

    expect(screen.getByText('Local list updated 1m ago · refreshes every 30s')).toBeTruthy();
  });
});
