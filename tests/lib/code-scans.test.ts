import {
  filterCodeScanFindings,
  groupCodeScanFindings,
} from '../../src/lib/code-scans';
import type { CodeScanFinding } from '../../src/api/devin/types';

function finding(overrides: Partial<CodeScanFinding>): CodeScanFinding {
  return {
    finding_id: 'finding-1',
    scan_id: 'scan-1',
    title: 'Unsafe input handling',
    description: null,
    recommendation: null,
    note: null,
    code_owners: [],
    reference_snippets: [],
    severity: 'medium',
    status: 'open',
    category: null,
    repo_name: 'DevinX',
    pr_url: null,
    session_id: null,
    orchestrator_session_id: null,
    created_at: 100,
    ...overrides,
  };
}

describe('Security Swarm scan presentation', () => {
  it('groups findings by scan and sorts newest scans first', () => {
    const scans = groupCodeScanFindings([
      finding({ finding_id: 'a', severity: 'critical', created_at: 100 }),
      finding({ finding_id: 'b', severity: 'high', status: 'resolved', created_at: 120 }),
      finding({ finding_id: 'c', scan_id: 'scan-2', repo_name: 'Bridge', created_at: 200 }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({ scanId: 'scan-2', repoName: 'Bridge', findingsCount: 1 }),
      expect.objectContaining({
        scanId: 'scan-1',
        createdAt: 120,
        findingsCount: 2,
        openCount: 1,
        criticalCount: 1,
        highCount: 1,
      }),
    ]);
  });

  it('filters findings by an explicit severity without altering all findings', () => {
    const findings = [
      finding({ finding_id: 'critical', severity: 'critical' }),
      finding({ finding_id: 'low', severity: 'low' }),
    ];

    expect(filterCodeScanFindings(findings, 'critical').map((item) => item.finding_id)).toEqual([
      'critical',
    ]);
    expect(filterCodeScanFindings(findings, 'all')).toHaveLength(2);
  });
});
