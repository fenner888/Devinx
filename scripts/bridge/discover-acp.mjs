#!/usr/bin/env node

import { spawn } from 'node:child_process';

const PROBE_VERSION = 1;
const ACP_PROTOCOL_VERSION = 1;
const INITIALIZE_REQUEST_ID = 'devinx-discovery-initialize';
const SESSION_LIST_REQUEST_ID = 'devinx-discovery-session-list';
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const KNOWN_CAPABILITY_NAMES = new Set([
  'loadSession',
  'mcpCapabilities.http',
  'mcpCapabilities.sse',
  'promptCapabilities.audio',
  'promptCapabilities.embeddedContext',
  'promptCapabilities.image',
  'sessionCapabilities.additionalDirectories',
  'sessionCapabilities.close',
  'sessionCapabilities.delete',
  'sessionCapabilities.fork',
  'sessionCapabilities.list',
  'sessionCapabilities.resume',
]);
const KNOWN_SESSION_FIELDS = [
  '_meta',
  'additionalDirectories',
  'cwd',
  'sessionId',
  'title',
  'updatedAt',
];
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

function includeSessionSchema() {
  const args = process.argv.slice(2);
  if (args.length === 0) return false;
  if (args.length === 1 && args[0] === '--session-schema') return true;
  throw new Error('Usage: discover-acp.mjs [--session-schema]');
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

function summarizeCapabilities(agentCapabilities) {
  const names = [...new Set(capabilityNames(agentCapabilities))];
  return {
    capabilities: names.filter((name) => KNOWN_CAPABILITY_NAMES.has(name)).sort(),
    unknownCapabilityCount: names.filter((name) => !KNOWN_CAPABILITY_NAMES.has(name)).length,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasSessionListCapability(agentCapabilities) {
  const list = agentCapabilities?.sessionCapabilities?.list;
  return isRecord(list);
}

function summarizeSessionList(result) {
  if (!isRecord(result) || !Array.isArray(result.sessions)) {
    throw new Error('ACP session list omitted the sessions array');
  }
  if (result.nextCursor !== undefined && typeof result.nextCursor !== 'string') {
    throw new Error('ACP session list returned an invalid pagination cursor');
  }

  const recognizedFields = new Set();
  const unknownFields = new Set();
  for (const session of result.sessions) {
    if (!isRecord(session)) throw new Error('ACP session list returned an invalid session');
    if (typeof session.sessionId !== 'string' || session.sessionId.length === 0) {
      throw new Error('ACP session list returned a session without an ID');
    }
    if (typeof session.cwd !== 'string' || session.cwd.length === 0) {
      throw new Error('ACP session list returned a session without a working directory');
    }
    for (const optionalString of ['title', 'updatedAt']) {
      if (session[optionalString] !== undefined && typeof session[optionalString] !== 'string') {
        throw new Error(`ACP session list returned an invalid ${optionalString} field`);
      }
    }
    if (
      session.additionalDirectories !== undefined &&
      (!Array.isArray(session.additionalDirectories) ||
        session.additionalDirectories.some(
          (directory) => typeof directory !== 'string' || directory.length === 0,
        ))
    ) {
      throw new Error('ACP session list returned invalid additional directories');
    }
    if (session._meta !== undefined && !isRecord(session._meta)) {
      throw new Error('ACP session list returned invalid metadata');
    }

    for (const field of Object.keys(session)) {
      if (KNOWN_SESSION_FIELDS.includes(field)) recognizedFields.add(field);
      else unknownFields.add(field);
    }
  }

  return {
    itemCount: result.sessions.length,
    responseFields: ['sessions', ...(result.nextCursor === undefined ? [] : ['nextCursor'])],
    recognizedSessionFields: [...recognizedFields].sort(),
    unknownSessionFieldCount: unknownFields.size,
    hasNextPage: result.nextCursor !== undefined,
  };
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

async function probeAcp(executable, environment, timeout, sessionSchemaRequested) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['acp'], {
      env: environment,
      shell: false,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let buffer = '';
    let outputBytes = 0;
    let settled = false;
    let initialization;
    let expectedRequestId = INITIALIZE_REQUEST_ID;

    const operationName = () =>
      expectedRequestId === INITIALIZE_REQUEST_ID ? 'initialization' : 'session list';

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stopChild(child);
      callback();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error(`ACP ${operationName()} timed out`)));
    }, timeout);

    child.on('error', () => {
      finish(() => reject(new Error('Devin ACP process could not be started')));
    });
    child.stdin.on('error', () => {
      finish(() => reject(new Error('Devin ACP input stream closed unexpectedly')));
    });
    child.on('close', () => {
      if (!settled) finish(() => reject(new Error(`Devin ACP exited before ${operationName()}`)));
    });
    child.stdout.on('data', (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        finish(() => reject(new Error(`ACP ${operationName()} exceeded the output limit`)));
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
        if (!isRecord(message) || message.jsonrpc !== '2.0') {
          finish(() => reject(new Error('ACP returned an invalid JSON-RPC message')));
          return;
        }
        if (message?.id !== expectedRequestId) continue;
        if (message.error) {
          const code = typeof message.error.code === 'number' ? message.error.code : 'unknown';
          finish(() => reject(new Error(`ACP ${operationName()} failed with code ${code}`)));
          return;
        }

        if (expectedRequestId === INITIALIZE_REQUEST_ID) {
          const result = message.result;
          if (!isRecord(result) || result.protocolVersion !== ACP_PROTOCOL_VERSION) {
            finish(() => reject(new Error('ACP negotiated an unsupported protocol version')));
            return;
          }
          if (!isRecord(result.agentCapabilities)) {
            finish(() => reject(new Error('ACP initialization omitted agent capabilities')));
            return;
          }

          initialization = {
            negotiatedProtocolVersion: result.protocolVersion,
            agent: {
              name: sanitizedText(result.agentInfo?.name, 'unknown'),
              version: sanitizedText(result.agentInfo?.version, 'unknown'),
            },
            ...summarizeCapabilities(result.agentCapabilities),
          };
          if (!sessionSchemaRequested) {
            finish(() => resolve(initialization));
            return;
          }
          if (!hasSessionListCapability(result.agentCapabilities)) {
            finish(() => reject(new Error('ACP agent does not advertise session listing')));
            return;
          }

          expectedRequestId = SESSION_LIST_REQUEST_ID;
          child.stdin.write(
            `${JSON.stringify({
              jsonrpc: '2.0',
              id: SESSION_LIST_REQUEST_ID,
              method: 'session/list',
              params: {},
            })}\n`,
          );
          continue;
        }

        let sessionList;
        try {
          sessionList = summarizeSessionList(message.result);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'ACP returned an invalid session list';
          finish(() => reject(new Error(reason)));
          return;
        }
        finish(() => resolve({ ...initialization, sessionList }));
        return;
      }
    });

    const request = {
      jsonrpc: '2.0',
      id: INITIALIZE_REQUEST_ID,
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
  const sessionSchemaRequested = includeSessionSchema();
  const executable = cliExecutable();
  const environment = safeEnvironment();
  const timeout = timeoutMs();
  const cliVersion = await readCliVersion(executable, environment, timeout);
  const acp = await probeAcp(executable, environment, timeout, sessionSchemaRequested);
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
