import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

import { ModeSettings } from '../../src/components/ModeSettings';

describe('documented Cloud mode settings', () => {
  it('offers every mode accepted by the public v3 API', () => {
    const onChange = jest.fn();
    const screen = render(
      <ModeSettings mode="normal" onChange={onChange} checkColor="black" mutedColor="gray" />,
    );

    expect(screen.getByLabelText('Use Normal Cloud mode').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByLabelText('Use Fast Cloud mode')).toBeTruthy();
    expect(screen.getByLabelText('Use Lite Cloud mode')).toBeTruthy();
    expect(screen.getByLabelText('Use Ultra Cloud mode')).toBeTruthy();
    expect(screen.getByLabelText('Use Fusion Cloud mode')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Use Fast Cloud mode'));
    expect(onChange).toHaveBeenCalledWith('fast');
    fireEvent.press(screen.getByLabelText('Use Fusion Cloud mode'));
    expect(onChange).toHaveBeenCalledWith('fusion');
  });
});
