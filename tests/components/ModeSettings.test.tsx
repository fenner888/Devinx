import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

import { ModeSettings } from '../../src/components/ModeSettings';

describe('documented Cloud mode settings', () => {
  it('offers only the modes accepted by the public v3 API', () => {
    const onChange = jest.fn();
    const screen = render(
      <ModeSettings mode="normal" onChange={onChange} checkColor="black" mutedColor="gray" />,
    );

    expect(screen.getByLabelText('Use Normal Cloud mode').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByLabelText('Use Fast Cloud mode')).toBeTruthy();
    expect(screen.queryByText('Fusion')).toBeNull();
    expect(screen.queryByText('Ultra')).toBeNull();
    expect(screen.queryByText('Lite')).toBeNull();

    fireEvent.press(screen.getByLabelText('Use Fast Cloud mode'));
    expect(onChange).toHaveBeenCalledWith('fast');
  });
});
