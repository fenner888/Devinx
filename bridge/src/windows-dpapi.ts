import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { isAbsolute, join } from 'node:path';

import { z } from 'zod';

import type { SecretStore } from './secret-store';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_SECRET_BYTES = 1024 * 1024;
const ITEM_NOT_FOUND_EXIT_CODE = 44;
const DEFAULT_HELPER_PATH = join(__dirname, 'windows-dpapi-helper.exe');

const optionsSchema = z
  .object({
    executablePath: z
      .string()
      .min(1)
      .max(4096)
      .refine(isAbsolute, 'DPAPI helper path must be absolute')
      .default(DEFAULT_HELPER_PATH),
    timeoutMs: z.number().int().min(1_000).max(60_000).default(DEFAULT_TIMEOUT_MS),
  })
  .strict();

export interface WindowsDpapiOptions {
  executablePath?: string;
  timeoutMs?: number;
}

interface CommandResult {
  code: number;
  stdout: string;
}

function safeWindowsEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? 'production',
    NO_COLOR: '1',
  };
  for (const key of [
    'APPDATA',
    'LANG',
    'LOCALAPPDATA',
    'Path',
    'PATHEXT',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'USERNAME',
  ] as const) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }
  return environment;
}

export class WindowsDpapiSecretStore implements SecretStore {
  private readonly options: z.infer<typeof optionsSchema>;

  constructor(options: WindowsDpapiOptions = {}) {
    this.options = optionsSchema.parse(options);
  }

  async get(): Promise<string | null> {
    const result = await this.run('get');
    if (result.code === ITEM_NOT_FOUND_EXIT_CODE) return null;
    if (result.code !== 0) throw new Error('Windows protected-state read failed');
    return result.stdout.replace(/\r?\n$/, '');
  }

  async set(value: string): Promise<void> {
    if (!value || Buffer.byteLength(value, 'utf8') > MAX_SECRET_BYTES) {
      throw new Error('Windows protected-state value is invalid');
    }
    const result = await this.run('set', value);
    if (result.code !== 0) throw new Error('Windows protected-state write failed');
  }

  async delete(): Promise<void> {
    const result = await this.run('delete');
    if (result.code !== 0 && result.code !== ITEM_NOT_FOUND_EXIT_CODE) {
      throw new Error('Windows protected-state delete failed');
    }
  }

  private run(operation: 'get' | 'set' | 'delete', input?: string): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const environment = safeWindowsEnvironment();
      const workingDirectory = environment.LOCALAPPDATA;
      if (!workingDirectory || !isAbsolute(workingDirectory)) {
        reject(new Error('Windows protected storage requires LOCALAPPDATA'));
        return;
      }
      const child: ChildProcessWithoutNullStreams = spawn(
        this.options.executablePath,
        [operation],
        {
          cwd: workingDirectory,
          env: environment,
          shell: false,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      const chunks: Buffer[] = [];
      let outputBytes = 0;
      let settled = false;

      const wipeChunks = () => {
        for (const stored of chunks) stored.fill(0);
        chunks.length = 0;
      };
      const terminate = () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        child.kill();
      };
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback();
      };
      const timer = setTimeout(() => {
        finish(() => {
          wipeChunks();
          terminate();
          reject(new Error('Windows protected-state operation timed out'));
        });
      }, this.options.timeoutMs);
      timer.unref();

      child.stderr.resume();
      child.on('error', () => {
        finish(() => {
          wipeChunks();
          reject(new Error('Windows protected-state helper could not be started'));
        });
      });
      child.stdin.on('error', () => {
        finish(() => {
          wipeChunks();
          terminate();
          reject(new Error('Windows protected-state input stream closed'));
        });
      });
      child.stdout.on('data', (chunk: Buffer) => {
        if (settled) return;
        outputBytes += chunk.length;
        if (outputBytes > MAX_SECRET_BYTES) {
          finish(() => {
            wipeChunks();
            terminate();
            reject(new Error('Windows protected-state output exceeded the size limit'));
          });
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      child.on('close', (code) => {
        finish(() => {
          const output = Buffer.concat(chunks);
          const stdout = output.toString('utf8');
          output.fill(0);
          wipeChunks();
          resolve({ code: code ?? 1, stdout });
        });
      });

      if (input === undefined) child.stdin.end();
      else child.stdin.end(input, 'utf8');
    });
  }
}
