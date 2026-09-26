import { spawnSync } from 'node:child_process';

// Advisories are identified by their GitHub advisory URL (GHSA ID). npm reassigns the numeric
// `source` id and rewrites `range` when it re-issues an advisory, so those are not stable keys.
const APPROVED_ADVISORIES = Object.freeze([
  Object.freeze({
    name: 'image-size',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
    maxAffectedVersion: '2.0.2',
  }),
  Object.freeze({
    name: 'image-size',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
    maxAffectedVersion: '2.0.2',
  }),
]);
const EXCEPTION_EXPIRES_AT = Date.UTC(2026, 10, 30);
const EXCEPTION_EXPIRY_LABEL = '2026-11-30';

function fail(message) {
  console.error(`Dependency audit gate failed: ${message}`);
  process.exit(1);
}

function runAudit() {
  const npmCli = process.env.npm_execpath;
  const executable = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = npmCli
    ? [npmCli, 'audit', '--json', '--audit-level=high']
    : ['audit', '--json', '--audit-level=high'];
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    fail(`npm audit could not run: ${result.error.message}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    fail(`npm audit returned invalid JSON${result.stderr ? `: ${result.stderr.trim()}` : ''}`);
  }
}

function advisoryLeaves(packageName, vulnerabilities, trail = []) {
  if (trail.includes(packageName)) {
    return [];
  }
  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
    fail(`npm audit did not provide a complete advisory chain for ${packageName}`);
  }

  return vulnerability.via.flatMap((entry) =>
    typeof entry === 'string'
      ? advisoryLeaves(entry, vulnerabilities, [...trail, packageName])
      : [entry],
  );
}

function compareVersions(a, b) {
  const [aParts, bParts] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i += 1) {
    if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
  }
  return 0;
}

// Returns the highest inclusive upper bound across every `||` clause, or null when any clause
// lacks a `<=` bound or contains anything other than `>=`/`<=` semver comparators.
function rangeUpperBound(range) {
  if (typeof range !== 'string' || range.trim() === '') return null;
  let highest = null;
  for (const clause of range.split('||')) {
    const comparators = clause.trim().split(/\s+/);
    let upper = null;
    for (const comparator of comparators) {
      const match = /^(>=|<=)(\d+\.\d+\.\d+)$/.exec(comparator);
      if (!match) return null;
      if (match[1] === '<=') {
        if (upper !== null) return null;
        upper = match[2];
      }
    }
    if (upper === null) return null;
    if (highest === null || compareVersions(upper, highest) > 0) highest = upper;
  }
  return highest;
}

function isApprovedAdvisory(advisory) {
  return APPROVED_ADVISORIES.some(
    (approved) =>
      advisory?.name === approved.name &&
      advisory?.severity === approved.severity &&
      advisory?.url === approved.url &&
      rangeUpperBound(advisory?.range) === approved.maxAffectedVersion,
  );
}

const report = runAudit();
const vulnerabilities = report?.vulnerabilities;
if (!vulnerabilities || typeof vulnerabilities !== 'object') {
  fail('npm audit omitted its vulnerability report');
}

const blocking = Object.entries(vulnerabilities).filter(([, vulnerability]) =>
  ['high', 'critical'].includes(vulnerability?.severity),
);
if (blocking.length === 0) {
  console.log('Dependency audit gate passed with zero high or critical vulnerabilities.');
  process.exit(0);
}

const unexpected = [];
for (const [packageName] of blocking) {
  const leaves = advisoryLeaves(packageName, vulnerabilities);
  if (leaves.length === 0) {
    unexpected.push({ packageName, advisory: 'no advisory leaf found' });
    continue;
  }
  for (const advisory of leaves) {
    if (!isApprovedAdvisory(advisory)) {
      unexpected.push({ packageName, advisory });
    }
  }
}
if (unexpected.length > 0) {
  fail(`unexpected high/critical advisory data:\n${JSON.stringify(unexpected, null, 2)}`);
}
if (Date.now() >= EXCEPTION_EXPIRES_AT) {
  fail(
    'The exact image-size toolchain advisories still require a reviewed upstream-compatible ' +
      `resolution; the temporary exception expired on ${EXCEPTION_EXPIRY_LABEL}`,
  );
}

console.warn(
  'Dependency audit gate passed with a temporary exception for two exact image-size advisories.',
);
console.warn(
  `${blocking.length} npm audit entries resolve exclusively to those build-toolchain advisories.`,
);
