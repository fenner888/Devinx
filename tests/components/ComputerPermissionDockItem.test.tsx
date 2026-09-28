import { fireEvent, render } from '@testing-library/react-native';

import type { ComputerSessionPermission } from '../../src/auth/computerBridge';
import { ComputerPermissionDockItem } from '../../src/components/sessions/ComputerPermissionDockItem';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const mockUseComputerSessionPermission = jest.fn();
const mockUseRespondComputerSessionPermission = jest.fn();
const mockMutatePermission = jest.fn();

jest.mock('../../src/api/bridge/queries', () => ({
  useComputerSessionPermission: (...args: unknown[]) =>
    mockUseComputerSessionPermission(...args),
  useRespondComputerSessionPermission: (...args: unknown[]) =>
    mockUseRespondComputerSessionPermission(...args),
}));

const permission: ComputerSessionPermission = {
  id: `permission_${'P'.repeat(43)}`,
  title: 'Run a command',
  decisions: ['allow_once', 'allow_session', 'reject_once'],
  createdAt: 1,
  expiresAt: 2,
};

describe('ComputerPermissionDockItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRespondComputerSessionPermission.mockReturnValue({
      mutate: mockMutatePermission,
      isPending: false,
      error: null,
    });
  });

  it('shows a loading line while permission data is null', () => {
    mockUseComputerSessionPermission.mockReturnValue({ data: null, isLoading: false });

    const screen = render(
      <ThemeProvider>
        <ComputerPermissionDockItem
          bridgeId="bridge_1234567890"
          sessionId={`local_${'L'.repeat(43)}`}
          onAnswered={jest.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('Loading approval…')).toBeTruthy();
  });

  it('shows the permission card and reports the full answered sentence', () => {
    mockUseComputerSessionPermission.mockReturnValue({ data: permission, isLoading: false });
    const onAnswered = jest.fn();

    const screen = render(
      <ThemeProvider>
        <ComputerPermissionDockItem
          bridgeId="bridge_1234567890"
          sessionId={`local_${'L'.repeat(43)}`}
          onAnswered={onAnswered}
        />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText('Allow command for this session'));

    expect(mockMutatePermission).toHaveBeenCalledWith(
      { permissionId: permission.id, decision: 'allow_session' },
      { onSuccess: expect.any(Function) },
    );
    mockMutatePermission.mock.calls[0]?.[1].onSuccess();
    expect(onAnswered).toHaveBeenCalledWith('You allowed this command for this session');
  });
});
