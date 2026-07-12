import {
  codeScanFindingSchema,
  codeScanMetricsRangeSchema,
  codeScanMetricsSchema,
  remediateFindingRequestSchema,
  remediateFindingResponseSchema,
} from '../../src/api/devin/schemas';

describe('Devin code-scan API boundaries', () => {
  it('accepts the documented metrics response and rejects invalid counts', () => {
    const response = {
      scans_count: 4,
      repos_scanned_count: 2,
      prs_created_count: 3,
      prs_open_count: 1,
      prs_merged_count: 2,
      prs_closed_count: 0,
      avg_pr_time_to_merge_seconds: null,
      avg_pr_open_duration_seconds: 120,
      open_critical_findings_count: 1,
      open_high_findings_count: 2,
      open_medium_findings_count: 3,
      open_low_findings_count: 4,
    };

    expect(codeScanMetricsSchema.parse(response)).toMatchObject(response);
    expect(() => codeScanMetricsSchema.parse({ ...response, scans_count: -1 })).toThrow();
  });

  it('bounds metric ranges to the documented 100-day maximum', () => {
    expect(
      codeScanMetricsRangeSchema.parse({ timeAfter: 100, timeBefore: 200 }),
    ).toEqual({ timeAfter: 100, timeBefore: 200 });
    expect(() =>
      codeScanMetricsRangeSchema.parse({ timeAfter: 200, timeBefore: 100 }),
    ).toThrow();
    expect(() =>
      codeScanMetricsRangeSchema.parse({ timeAfter: 0, timeBefore: 101 * 24 * 60 * 60 }),
    ).toThrow();
  });

  it('requires the documented finding evidence fields', () => {
    expect(
      codeScanFindingSchema.parse({
        finding_id: 'finding-1',
        scan_id: 'scan-1',
        title: null,
        description: null,
        recommendation: null,
        note: null,
        code_owners: ['@security'],
        reference_snippets: [
          {
            file_path: 'src/auth.ts',
            start_line: 10,
            end_line: 12,
            commentary: 'Unsanitized input reaches a sensitive sink.',
            code: null,
          },
        ],
        severity: 'high',
        status: 'open',
        category: 'injection',
        repo_name: 'DevinX',
        pr_url: null,
        session_id: null,
        orchestrator_session_id: null,
        created_at: 100,
      }),
    ).toMatchObject({ finding_id: 'finding-1', severity: 'high' });
  });

  it('validates remediation identifiers and response session IDs', () => {
    expect(remediateFindingRequestSchema.parse({ scanId: 'scan-1', findingId: 'finding-1' })).toEqual({
      scanId: 'scan-1',
      findingId: 'finding-1',
    });
    expect(() => remediateFindingRequestSchema.parse({ scanId: '', findingId: 'finding-1' })).toThrow();
    expect(
      remediateFindingResponseSchema.parse({ finding_id: 'finding-1', session_id: 'session-1' }),
    ).toMatchObject({ session_id: 'session-1' });
  });
});
