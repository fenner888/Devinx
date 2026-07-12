import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockRefetchFindings = jest.fn();
const mockRefetchMetrics = jest.fn();
const mockRemediate = jest.fn();
let mockFindingsQuery: Record<string, unknown>;
let mockMetricsQuery: Record<string, unknown>;

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));
jest.mock('@lib/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticError: jest.fn(),
}));
jest.mock('@api/devin/queries', () => ({
  useCodeScanFindings: () => mockFindingsQuery,
  useCodeScanMetrics: () => mockMetricsQuery,
  useRemediateFinding: () => ({ isPending: false, mutate: mockRemediate }),
}));

import SecurityScreen from '../../src/app/(main)/security';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { ApiError } from '../../src/api/devin/client';

function renderScreen() {
  return render(
    <ThemeProvider>
      <SecurityScreen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockFindingsQuery = {
    data: [
      {
        finding_id: 'finding-1',
        scan_id: 'scan-1',
        title: 'Unsafe input handling',
        description: 'Input reaches a sensitive operation.',
        recommendation: 'Validate the input before use.',
        note: null,
        code_owners: [],
        reference_snippets: [],
        severity: 'critical',
        status: 'open',
        category: 'injection',
        repo_name: 'DevinX',
        pr_url: null,
        session_id: null,
        orchestrator_session_id: null,
        created_at: 100,
      },
    ],
    isLoading: false,
    error: null,
    refetch: mockRefetchFindings,
    isRefetching: false,
  };
  mockMetricsQuery = {
    data: {
      scans_count: 1,
      repos_scanned_count: 1,
      prs_created_count: 0,
      prs_open_count: 0,
      prs_merged_count: 0,
      prs_closed_count: 0,
      avg_pr_time_to_merge_seconds: null,
      avg_pr_open_duration_seconds: null,
      open_critical_findings_count: 1,
      open_high_findings_count: 0,
      open_medium_findings_count: 0,
      open_low_findings_count: 0,
    },
    isLoading: false,
    error: null,
    refetch: mockRefetchMetrics,
    isRefetching: false,
  };
  mockRemediate.mockReset();
});

describe('Security screen', () => {
  it('shows native metrics and scan-grouped navigation into findings', () => {
    const screen = renderScreen();

    expect(screen.getByText('Security Swarm')).toBeTruthy();
    expect(screen.getByText('Scans · 30 days')).toBeTruthy();
    expect(screen.getByText('DevinX')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open DevinX scan findings'));
    expect(screen.getByText('Unsafe input handling')).toBeTruthy();
  });

  it('explains enterprise permission requirements without exposing findings', () => {
    mockFindingsQuery = {
      ...mockFindingsQuery,
      data: undefined,
      error: new ApiError('Permission denied', 403, 'permission'),
    };

    const screen = renderScreen();
    expect(screen.getByText('Enterprise access required')).toBeTruthy();
    expect(screen.queryByText('Unsafe input handling')).toBeNull();
  });
});
