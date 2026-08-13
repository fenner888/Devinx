import { spawnSync } from 'node:child_process';

const APPROVED_ADVISORIES = Object.freeze([
  Object.freeze({
    source: 1138808,
    name: 'image-size',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
    range: '<=2.0.2',
  }),
  Object.freeze({
    source: 1138809,
    name: 'image-size',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
    range: '<=2.0.2',
  }),
]);
const EXCEPTION_EXPIRES_AT = Date.UTC(2026, 8, 30);

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

function isApprovedAdvisory(advisory) {
  return APPROVED_ADVISORIES.some(
    (approved) =>
      advisory?.source === approved.source &&
      advisory?.name === approved.name &&
      advisory?.severity === approved.severity &&
      advisory?.url === approved.url &&
      advisory?.range === approved.range,
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
      'resolution; the temporary exception expired on 2026-09-30',
  );
}

console.warn(
  'Dependency audit gate passed with a temporary exception for two exact image-size advisories.',
);
console.warn(
  `${blocking.length} npm audit entries resolve exclusively to those build-toolchain advisories.`,
);
