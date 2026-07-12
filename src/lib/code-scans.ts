import type { CodeScanFinding, FindingSeverity } from '@api/devin/types';

export interface CodeScanSummary {
  scanId: string;
  repoName: string;
  createdAt: number;
  findingsCount: number;
  openCount: number;
  criticalCount: number;
  highCount: number;
}

export type FindingSeverityFilter = FindingSeverity | 'all';

export function groupCodeScanFindings(findings: CodeScanFinding[]): CodeScanSummary[] {
  const scans = new Map<string, CodeScanSummary>();
  for (const finding of findings) {
    const current = scans.get(finding.scan_id) ?? {
      scanId: finding.scan_id,
      repoName: finding.repo_name,
      createdAt: finding.created_at,
      findingsCount: 0,
      openCount: 0,
      criticalCount: 0,
      highCount: 0,
    };
    current.createdAt = Math.max(current.createdAt, finding.created_at);
    current.findingsCount += 1;
    if (finding.status === 'open') current.openCount += 1;
    if (finding.severity === 'critical') current.criticalCount += 1;
    if (finding.severity === 'high') current.highCount += 1;
    scans.set(finding.scan_id, current);
  }
  return [...scans.values()].sort((left, right) => right.createdAt - left.createdAt);
}

export function filterCodeScanFindings(
  findings: CodeScanFinding[],
  severity: FindingSeverityFilter,
): CodeScanFinding[] {
  return findings.filter((finding) => severity === 'all' || finding.severity === severity);
}
