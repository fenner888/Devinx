import { spawnSync } from 'node:child_process';

const APPROVED_ADVISORY = Object.freeze({
  source: 1124334,
  name: 'brace-expansion',
  severity: 'high',
  url: 'https://github.com/advisories/GHSA-mh99-v99m-4gvg',
  range: '<=5.0.7',
});
const EXCEPTION_EXPIRES_AT = Date.UTC(2026, 7, 8);

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
    fail(`npm audit reported a cyclic vulnerability chain: ${[...trail, packageName].join(' -> ')}`);
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
  return (
    advisory?.source === APPROVED_ADVISORY.source &&
    advisory?.name === APPROVED_ADVISORY.name &&
    advisory?.severity === APPROVED_ADVISORY.severity &&
    advisory?.url === APPROVED_ADVISORY.url &&
    advisory?.range === APPROVED_ADVISORY.range
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
  for (const advisory of advisoryLeaves(packageName, vulnerabilities)) {
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
    `${APPROVED_ADVISORY.url} still requires a reviewed upstream-compatible resolution; ` +
      'the temporary toolchain exception expired on 2026-08-08',
  );
}

console.warn(
  `Dependency audit gate passed with a temporary exception for ${APPROVED_ADVISORY.url}.`,
);
console.warn(
  `${blocking.length} npm audit entries resolve exclusively to that one build/test-toolchain advisory.`,
);
