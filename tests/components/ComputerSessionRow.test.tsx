import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('../../src/theme/index', () => ({
  useTheme: () => ({
    tokens: {
      brandText: { hex: '#0088ff' },
      textMid: { hex: '#777777' },
    },
  }),
}));

import {
  ComputerDiscoveryNotices,
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
};

describe('Computer session presentation', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2027-01-15T13:00:00.000Z'));
  });

  afterEach(() => jest.restoreAllMocks());

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
});
