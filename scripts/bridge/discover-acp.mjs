#!/usr/bin/env node

import { spawn } from 'node:child_process';

const PROBE_VERSION = 1;
const ACP_PROTOCOL_VERSION = 1;
const REQUEST_ID = 'devinx-discovery-initialize';
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const SAFE_ENV_KEYS = [
  'HOME',
  'LANG',
  'LC_ALL',
  'LOGNAME',
  'PATH',
  'SHELL',
  'TMPDIR',
  'USER',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
];

function safeEnvironment() {
  const env = { NO_COLOR: '1' };
  for (const key of SAFE_ENV_KEYS) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

function timeoutMs() {
  const configured = Number.parseInt(process.env.DEVIN_BRIDGE_DISCOVERY_TIMEOUT_MS ?? '', 10);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(configured, 1_000), 15_000);
}

function cliExecutable() {
  return process.env.DEVIN_CLI_PATH || 'devin';
}

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const forceKill = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }, 250);
  forceKill.unref();
}

function sanitizedText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160);
  return clean || fallback;
}

function capabilityNames(value, prefix = '') {
  if (value === false || value === null || value === undefined) return [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  const entries = Object.entries(value).filter(([key]) => key !== '_meta');
  if (entries.length === 0) return prefix ? [prefix] : [];

  return entries.flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child === false || child === null || child === undefined) return [];
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return capabilityNames(child, path);
    }
    return [path];
  });
}

async function readCliVersion(executable, environment, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['version'], {
      env: environment,
      shell: false,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let output = '';
    let outputBytes = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      stopChild(child);
      reject(new Error('CLI version probe timed out'));
    }, timeout);

    child.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('Devin CLI executable could not be started'));
    });
    child.stdout.on('data', (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        settled = true;
        clearTimeout(timer);
        stopChild(child);
        reject(new Error('CLI version probe exceeded the output limit'));
        return;
      }
      output += chunk.toString('utf8');
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error('Devin CLI version command failed'));
        return;
      }
      resolve(sanitizedText(output.split(/\r?\n/, 1)[0], 'unknown'));
    });
  });
}

async function initializeAcp(executable, environment, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['acp'], {
      env: environment,
      shell: false,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let buffer = '';
    let outputBytes = 0;
    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stopChild(child);
      callback();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error('ACP initialization timed out')));
    }, timeout);

    child.on('error', () => {
      finish(() => reject(new Error('Devin ACP process could not be started')));
    });
    child.on('close', () => {
      if (!settled) finish(() => reject(new Error('Devin ACP exited before initialization')));
    });
    child.stdout.on('data', (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        finish(() => reject(new Error('ACP initialization exceeded the output limit')));
        return;
      }

      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          finish(() => reject(new Error('ACP returned an invalid JSON-RPC message')));
          return;
        }
        if (message?.id !== REQUEST_ID) continue;
        if (message.error) {
          const code = typeof message.error.code === 'number' ? message.error.code : 'unknown';
          finish(() => reject(new Error(`ACP initialization failed with code ${code}`)));
          return;
        }

        const result = message.result;
        if (!result || result.protocolVersion !== ACP_PROTOCOL_VERSION) {
          finish(() => reject(new Error('ACP negotiated an unsupported protocol version')));
          return;
        }
        if (!result.agentCapabilities || typeof result.agentCapabilities !== 'object') {
          finish(() => reject(new Error('ACP initialization omitted agent capabilities')));
          return;
        }

        finish(() =>
          resolve({
            negotiatedProtocolVersion: result.protocolVersion,
            agent: {
              name: sanitizedText(result.agentInfo?.name, 'unknown'),
              version: sanitizedText(result.agentInfo?.version, 'unknown'),
            },
            capabilities: [...new Set(capabilityNames(result.agentCapabilities))].sort(),
          }),
        );
        return;
      }
    });

    const request = {
      jsonrpc: '2.0',
      id: REQUEST_ID,
      method: 'initialize',
      params: {
        protocolVersion: ACP_PROTOCOL_VERSION,
        clientCapabilities: {},
        clientInfo: { name: 'devinx-bridge-discovery', version: String(PROBE_VERSION) },
      },
    };
    child.stdin.write(`${JSON.stringify(request)}\n`);
  });
}

async function main() {
  const executable = cliExecutable();
  const environment = safeEnvironment();
  const timeout = timeoutMs();
  const cliVersion = await readCliVersion(executable, environment, timeout);
  const acp = await initializeAcp(executable, environment, timeout);
  process.stdout.write(
    `${JSON.stringify(
      {
        probeVersion: PROBE_VERSION,
        cli: { version: cliVersion },
        acp: {
          requestedProtocolVersion: ACP_PROTOCOL_VERSION,
          ...acp,
        },
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown discovery failure';
  process.stderr.write(`Bridge discovery failed: ${sanitizedText(message, 'Unknown failure')}\n`);
  process.exitCode = 1;
});
