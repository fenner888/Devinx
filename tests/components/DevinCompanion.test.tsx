import { act, fireEvent, render, within } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, AppState, type AppStateStatus } from 'react-native';
import { DevinCompanion } from '../../src/components/pets/DevinCompanion';
import { DEVIN_FRAME_SETS } from '../../src/pets/devin/assets';
import { DEVIN_STATE_ANIMATIONS } from '../../src/pets/devin/model';

describe('DevinCompanion', () => {
  let reduceMotionEnabled = false;
  let reduceMotionListener: ((enabled: boolean) => void) | undefined;
  let appStateListener: ((state: AppStateStatus) => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotionEnabled = false;
    reduceMotionListener = undefined;
    appStateListener = undefined;
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockImplementation(async () => reduceMotionEnabled);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      event: string,
      listener: (enabled: boolean) => void,
    ) => {
      if (event === 'reduceMotionChanged') reduceMotionListener = listener;
      return { remove: jest.fn() };
    }) as never);
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      event: string,
      listener: (state: AppStateStatus) => void,
    ) => {
      if (event === 'change') appStateListener = listener;
      return { remove: jest.fn() };
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function resolveMotionPreference() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('cycles frames and cleans up its interval', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const { getByTestId, unmount } = render(<DevinCompanion state="idle" />);
    await resolveMotionPreference();

    expect(getByTestId('devin-companion-frame').props.source).toBe(
      DEVIN_STATE_ANIMATIONS.idle.frames[0],
    );
    act(() => jest.advanceTimersByTime(350));
    expect(getByTestId('devin-companion-frame').props.source).toBe(
      DEVIN_STATE_ANIMATIONS.idle.frames[1],
    );

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('does not restart animation when only the message changes', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const { rerender } = render(<DevinCompanion state="working" message="First" />);
    await resolveMotionPreference();
    const intervalCount = setIntervalSpy.mock.calls.length;

    rerender(<DevinCompanion state="working" message="Second" />);

    expect(setIntervalSpy).toHaveBeenCalledTimes(intervalCount);
  });

  it('resets to the first frame when state changes', async () => {
    const { getByTestId, rerender } = render(<DevinCompanion state="idle" />);
    await resolveMotionPreference();
    act(() => jest.advanceTimersByTime(350));
    expect(getByTestId('devin-companion-frame').props.source).toBe(
      DEVIN_STATE_ANIMATIONS.idle.frames[1],
    );

    rerender(<DevinCompanion state="waiting" />);

    expect(getByTestId('devin-companion-frame').props.source).toBe(DEVIN_FRAME_SETS.waiting[0]);
  });

  it('stops a non-looping animation on its final frame', async () => {
    const { getByTestId } = render(<DevinCompanion state="success" />);
    await resolveMotionPreference();

    act(() => jest.advanceTimersByTime(1000));

    expect(getByTestId('devin-companion-frame').props.source).toBe(
      DEVIN_FRAME_SETS.jumping[DEVIN_FRAME_SETS.jumping.length - 1],
    );
  });

  it('stays still for Reduce Motion and while the app is backgrounded', async () => {
    reduceMotionEnabled = true;
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    render(<DevinCompanion state="idle" />);
    await resolveMotionPreference();

    expect(setIntervalSpy).not.toHaveBeenCalled();

    act(() => reduceMotionListener?.(false));
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    act(() => appStateListener?.('background'));
    const intervalCount = setIntervalSpy.mock.calls.length;
    act(() => appStateListener?.('active'));
    expect(setIntervalSpy).toHaveBeenCalledTimes(intervalCount + 1);
  });

  it('pauses while its owning screen is unfocused', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const { rerender } = render(<DevinCompanion state="idle" active />);
    await resolveMotionPreference();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    rerender(<DevinCompanion state="idle" active={false} />);
    const intervalCount = setIntervalSpy.mock.calls.length;
    rerender(<DevinCompanion state="idle" active />);

    expect(setIntervalSpy).toHaveBeenCalledTimes(intervalCount + 1);
  });

  it('travels across its measured track with directional walking frames', async () => {
    const timingSpy = jest.spyOn(Animated, 'timing');
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const { getByTestId, unmount } = render(
      <DevinCompanion state="thinking" size={72} travel />,
    );
    await resolveMotionPreference();

    expect(getByTestId('devin-companion-frame').props.source).toBe(
      DEVIN_FRAME_SETS['running-right'][0],
    );

    fireEvent(getByTestId('devin-companion-track'), 'layout', {
      nativeEvent: { layout: { height: 72, width: 320, x: 0, y: 0 } },
    });

    expect(getByTestId('devin-companion-frame').props.source).toBe(
      DEVIN_FRAME_SETS['running-left'][0],
    );
    expect(timingSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 0, useNativeDriver: true }),
    );
    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      125,
    );

    unmount();
  });

  it('keeps the travel track still when Reduce Motion is enabled', async () => {
    reduceMotionEnabled = true;
    const timingSpy = jest.spyOn(Animated, 'timing');
    const { getByTestId } = render(<DevinCompanion state="thinking" size={72} travel />);
    await resolveMotionPreference();

    fireEvent(getByTestId('devin-companion-track'), 'layout', {
      nativeEvent: { layout: { height: 72, width: 320, x: 0, y: 0 } },
    });

    expect(timingSpy).not.toHaveBeenCalled();
    expect(getByTestId('devin-companion-frame').props.source).toBe(
      DEVIN_FRAME_SETS['running-left'][0],
    );
  });

  it('keeps the same track mounted when travel starts and stops', async () => {
    const { getByTestId, rerender } = render(
      <DevinCompanion state="waiting" size={72} travelTrack />,
    );
    await resolveMotionPreference();
    const track = getByTestId('devin-companion-track');

    fireEvent(track, 'layout', {
      nativeEvent: { layout: { height: 72, width: 320, x: 0, y: 0 } },
    });
    rerender(<DevinCompanion state="thinking" size={72} travel travelTrack />);
    rerender(<DevinCompanion state="success" size={72} travelTrack />);

    expect(getByTestId('devin-companion-track')).toBe(track);
    expect(getByTestId('devin-companion-frame').props.source).toBe(
      DEVIN_FRAME_SETS.jumping[0],
    );
  });

  it('keeps a compact task caption attached to the traveling companion', async () => {
    const { getByTestId, getByText, rerender } = render(
      <DevinCompanion
        state="working"
        size={104}
        message="Editing the authentication middleware"
        travel
        travelTrack
      />,
    );
    await resolveMotionPreference();

    expect(getByTestId('devin-companion-task-caption')).toBeTruthy();
    expect(
      within(getByTestId('devin-companion-traveler')).getByText(
        'Editing the authentication middleware',
      ),
    ).toBeTruthy();

    rerender(<DevinCompanion state="waiting" size={104} travelTrack />);
    expect(getByText('Waiting for your reply')).toBeTruthy();
  });

  it('suppresses the message in compact mode', async () => {
    const { queryByText } = render(
      <DevinCompanion state="waiting" compact message="Waiting for response" />,
    );
    await resolveMotionPreference();

    expect(queryByText('Waiting for response')).toBeNull();
  });
});
