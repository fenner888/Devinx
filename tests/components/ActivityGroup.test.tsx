import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { ComputerActivityEntry } from '../../src/auth/computerBridge';
import { statusLabels } from '../../src/theme/tokens';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('../../src/theme/index', () => ({
  useTheme: () => ({
    tokens: {
      textMid: { hex: '#777777' },
      textLow: { hex: '#555555' },
      textHi: { hex: '#eeeeee' },
      brandText: { hex: '#0088ff' },
      running: { hex: '#0088ff' },
      failed: { hex: '#ff3333' },
      blocked: { hex: '#ee8833' },
    },
  }),
}));

jest.mock('../../src/components/DevinMarkdown', () => {
  const { Text } = jest.requireActual<{ Text: typeof import('react-native').Text }>(
    'react-native',
  );
  return {
    DevinMarkdown: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

import { ActivityGroup, groupActivity, summarizeActivity } from '../../src/components/sessions/ActivityGroup';
import { useActivityExpansion } from '../../src/store/activityExpansion';

const BRIDGE = 'bridge_1234567890';
const SESSION = `local_${'L'.repeat(43)}`;

function entry(overrides: Partial<ComputerActivityEntry>): ComputerActivityEntry {
  return {
    id: `entry_${Math.random().toString(36).slice(2)}`,
    afterSequence: 0,
    kind: 'tool',
    status: 'completed',
    title: 'Tool call',
    truncated: false,
    ...overrides,
  };
}

describe('summarizeActivity', () => {
  it('counts each tool kind and omits zero counts', () => {
    const summary = summarizeActivity([
      entry({ kind: 'thought', title: 'Thought' }),
      entry({ toolKind: 'read', title: 'Read a' }),
      entry({ toolKind: 'read', title: 'Read b' }),
      entry({ toolKind: 'edit', title: 'Edit a' }),
      entry({ toolKind: 'execute', title: 'Ran x' }),
      entry({ toolKind: 'search', title: 'Search' }),
      entry({ toolKind: 'fetch', title: 'Fetched' }),
    ]);
    expect(summary).toBe(
      'Thought · Read 2 files · Edited 1 file · Ran 1 command · Searched · Fetched 1 page',
    );
  });

  it('groups delete/move as changes and think/other as steps', () => {
    const summary = summarizeActivity([
      entry({ toolKind: 'delete', title: 'Delete' }),
      entry({ toolKind: 'move', title: 'Move' }),
      entry({ toolKind: 'other', title: 'Step' }),
    ]);
    expect(summary).toBe('Changed 2 files · 1 step');
  });

  it('appends a duration from startedAt to endedAt', () => {
    const summary = summarizeActivity([
      entry({ title: 'Work', startedAt: 1_000, endedAt: 15_000 }),
    ]);
    expect(summary).toBe('1 step · 14s');
  });
});

describe('groupActivity', () => {
  it('buckets entries by afterSequence', () => {
    const groups = groupActivity([
      entry({ afterSequence: 0, title: 'a' }),
      entry({ afterSequence: 2, title: 'b' }),
      entry({ afterSequence: 2, title: 'c' }),
    ]);
    expect(groups.get(0)).toHaveLength(1);
    expect(groups.get(2)).toHaveLength(2);
  });
});

describe('ActivityGroup', () => {
  beforeEach(() => {
    useActivityExpansion.setState({ expanded: {} });
  });

  it('hides steps when collapsed and reveals them on header press', () => {
    const entries = [entry({ title: 'Read notes.txt', toolKind: 'read' })];
    const screen = render(
      <ActivityGroup
        bridgeId={BRIDGE}
        sessionId={SESSION}
        groupKey="g1"
        entries={entries}
        defaultExpanded={false}
      />,
    );
    expect(screen.getByTestId('activity-group-g1')).toBeTruthy();
    expect(screen.queryByText('Read notes.txt')).toBeNull();

    fireEvent.press(screen.getByTestId('activity-group-header-g1'));
    expect(screen.getByText('Read notes.txt')).toBeTruthy();
  });

  it('shows diff lines with added and removed markers when a step expands', () => {
    const entries = [
      entry({
        id: 'entry_diff',
        title: 'Edit notes.txt',
        toolKind: 'edit',
        detail: {
          type: 'diff',
          path: 'notes.txt',
          oldText: 'same\nhello world\nsame',
          newText: 'same\ngoodbye world\nsame',
        },
      }),
    ];
    const screen = render(
      <ActivityGroup
        bridgeId={BRIDGE}
        sessionId={SESSION}
        groupKey="g1"
        entries={entries}
        defaultExpanded
      />,
    );
    fireEvent.press(screen.getByLabelText('Edit notes.txt, Completed'));
    expect(screen.getByTestId('activity-detail-entry_diff')).toBeTruthy();
    expect(screen.getAllByTestId('activity-diff-line-removed')).toHaveLength(1);
    expect(screen.getAllByTestId('activity-diff-line-added')).toHaveLength(1);
  });

  it('renders non-completed status labels in text and accessibility labels', () => {
    for (const status of ['failed', 'interrupted', 'unknown'] as const) {
      const screen = render(
        <ActivityGroup
          bridgeId={BRIDGE}
          sessionId={SESSION}
          groupKey={`g_${status}`}
          entries={[entry({ title: 'Tool', status })]}
          defaultExpanded={false}
        />,
      );
      expect(screen.getByText(statusLabels[status])).toBeTruthy();
      expect(
        screen.getByLabelText(new RegExp(`${statusLabels[status]}$`)),
      ).toBeTruthy();
      screen.unmount();
    }
  });

  it('renders a live group with reply markdown and a generating caption', () => {
    const screen = render(
      <ActivityGroup
        bridgeId={BRIDGE}
        sessionId={SESSION}
        groupKey="live"
        entries={[entry({ title: 'Thinking', kind: 'thought', status: 'running' })]}
        live
        defaultExpanded
        reply="Working on it…"
      />,
    );
    expect(screen.getByText('Working on it…')).toBeTruthy();
    expect(screen.getByText('Generating…')).toBeTruthy();
  });

  it('remembers expansion across remounts and isolates sessions', () => {
    const entries = [entry({ title: 'Read notes.txt' })];
    const first = render(
      <ActivityGroup
        bridgeId={BRIDGE}
        sessionId={SESSION}
        groupKey="g1"
        entries={entries}
        defaultExpanded={false}
      />,
    );
    fireEvent.press(first.getByTestId('activity-group-header-g1'));
    first.unmount();

    const remounted = render(
      <ActivityGroup
        bridgeId={BRIDGE}
        sessionId={SESSION}
        groupKey="g1"
        entries={entries}
        defaultExpanded={false}
      />,
    );
    expect(remounted.getByText('Read notes.txt')).toBeTruthy();
    remounted.unmount();

    const otherSession = render(
      <ActivityGroup
        bridgeId={BRIDGE}
        sessionId={`local_${'M'.repeat(43)}`}
        groupKey="g1"
        entries={entries}
        defaultExpanded={false}
      />,
    );
    expect(otherSession.queryByText('Read notes.txt')).toBeNull();
  });
});
