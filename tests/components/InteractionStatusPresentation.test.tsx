import type React from 'react';
import { render } from '@testing-library/react-native';

import type {
  ComputerActivityEntry,
  ComputerActivityStatus,
} from '../../src/auth/computerBridge';
import { ActivityGroup } from '../../src/components/sessions/ActivityGroup';
import { ComputerSessionRow } from '../../src/components/sessions/ComputerSessionRow';
import { devinStateForStatusKey } from '../../src/pets/devin/model';
import { statusLabels } from '../../src/theme/tokens';
import { useActivityExpansion } from '../../src/store/activityExpansion';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('../../src/theme/index', () => ({
  useTheme: () => ({
    tokens: {
      brand: { hex: '#0088ff' },
      brandText: { hex: '#0088ff' },
      textMid: { hex: '#777777' },
      textLow: { hex: '#555555' },
      textHi: { hex: '#eeeeee' },
      running: { hex: '#0088ff' },
      failed: { hex: '#ff3333' },
      blocked: { hex: '#ee8833' },
    },
  }),
}));

jest.mock('../../src/components/DevinMarkdown', () => {
  const { Text: MockText } = jest.requireActual<{
    Text: typeof import('react-native').Text;
  }>('react-native');
  return {
    DevinMarkdown: ({ children }: { children: React.ReactNode }) => <MockText>{children}</MockText>,
  };
});

function entry(status: ComputerActivityStatus, id: string): ComputerActivityEntry {
  return {
    id,
    afterSequence: 0,
    kind: 'tool',
    toolKind: 'execute',
    status,
    title: 'Run command',
    truncated: false,
  };
}

describe('interaction status presentation', () => {
  beforeEach(() => {
    useActivityExpansion.setState({ expanded: {} });
  });

  it('prioritizes awaiting input and uses the brand status dot', () => {
    const screen = render(
      <ActivityGroup
        bridgeId="bridge_1234567890"
        sessionId={`local_${'L'.repeat(43)}`}
        groupKey="g0"
        entries={[
          entry('running', 'running'),
          entry('failed', 'failed'),
          entry('timed_out', 'timed-out'),
          entry('awaiting_input', 'awaiting'),
        ]}
        defaultExpanded={false}
      />,
    );

    expect(screen.getByText('Waiting for your answer')).toBeTruthy();
    expect(screen.getByTestId('activity-group-status-dot').props.style.backgroundColor).toBe(
      '#0088ff',
    );
  });

  it('shows a timeout as blocked rather than failed', () => {
    const screen = render(
      <ActivityGroup
        bridgeId="bridge_1234567890"
        sessionId={`local_${'L'.repeat(43)}`}
        groupKey="g0"
        entries={[entry('timed_out', 'timed-out')]}
        defaultExpanded={false}
      />,
    );

    expect(screen.getByText('Timed out')).toBeTruthy();
    expect(screen.getByTestId('activity-group-status-dot').props.style.backgroundColor).toBe(
      '#ee8833',
    );
  });

  it('uses the waiting answer label in the session row and its accessibility name', () => {
    const screen = render(
      <ComputerSessionRow
        session={{
          id: `local_${'L'.repeat(43)}`,
          origin: 'computer',
          workspaceName: 'DevinX',
          hasTitle: false,
          bridgeId: 'bridge_1234567890',
          computerName: 'Studio Mac',
          canLoad: true,
          activity: {
            active: true,
            kind: 'executing',
            awaiting: 'approval',
            updatedAt: Date.now(),
          },
        }}
      />,
    );

    expect(screen.getByText('Waiting for your answer')).toBeTruthy();
    expect(screen.getByLabelText(/Waiting for your answer/)).toBeTruthy();
  });

  it('maps both new statuses to the blocked companion state', () => {
    expect(statusLabels.awaiting_input).toBe('Waiting for your answer');
    expect(statusLabels.timed_out).toBe('Timed out');
    expect(devinStateForStatusKey('awaiting_input')).toBe('blocked');
    expect(devinStateForStatusKey('timed_out')).toBe('blocked');
  });
});
