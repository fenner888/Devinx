import { fireEvent, render, within } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('../../src/theme/index', () => ({
  useTheme: () => ({
    tokens: {
      finished: { hex: 'green' },
      textLow: { hex: 'gray' },
    },
  }),
}));

import {
  ComputerPermissionsSheet,
  type ComputerGrants,
} from '../../src/components/connections/ComputerPermissionsSheet';

const grants: ComputerGrants = {
  viewSessions: true,
  sendPrompts: false,
  startSessions: false,
};

describe('ComputerPermissionsSheet', () => {
  it('shows allowed and disallowed grant rows with Connector guidance', () => {
    const screen = render(
      <ComputerPermissionsSheet
        visible
        onClose={jest.fn()}
        computerName="Studio Mac"
        grants={grants}
        source="connector"
      />,
    );

    expect(screen.getByText('Permissions on Studio Mac')).toBeTruthy();
    expect(within(screen.getByTestId('permission-row-view')).getByText('Allowed')).toBeTruthy();
    expect(
      within(screen.getByTestId('permission-row-prompt')).getByText('Not allowed'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('permission-row-create')).getByText('Not allowed'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Permissions are managed in DevinX Connector on Studio Mac. Open it and change what this iPhone is allowed to do — you don't need to pair again.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Shown as granted when this iPhone was paired. Update DevinX Connector to see its current permissions.',
      ),
    ).toBeNull();
  });

  it('shows the pairing-source footnote and closes from Done', () => {
    const onClose = jest.fn();
    const screen = render(
      <ComputerPermissionsSheet
        visible
        onClose={onClose}
        computerName="Studio Mac"
        grants={grants}
        source="pairing"
      />,
    );

    expect(
      screen.getByText(
        'Shown as granted when this iPhone was paired. Update DevinX Connector to see its current permissions.',
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
