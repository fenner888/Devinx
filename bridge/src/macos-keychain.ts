import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { isAbsolute } from 'node:path';

import { z } from 'zod';

const DEFAULT_SECURITY_PATH = '/usr/bin/security';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_SECRET_BYTES = 1024 * 1024;
const ITEM_NOT_FOUND_EXIT_CODE = 44;

const optionsSchema = z
  .object({
    executablePath: z
      .string()
      .min(1)
      .max(4096)
      .refine(isAbsolute, 'security executable path must be absolute')
      .default(DEFAULT_SECURITY_PATH),
    service: z.string().min(1).max(255).default('com.devinx.desktop-bridge'),
    account: z.string().min(1).max(255).default('bridge-state-v1'),
    trustedApplicationPath: z
      .string()
      .max(4096)
      .refine((value) => value === '' || isAbsolute(value), 'trusted application path must be absolute')
      .default(''),
    timeoutMs: z.number().int().min(1_000).max(60_000).default(DEFAULT_TIMEOUT_MS),
  })
  .strict();

export interface KeychainSecretStore {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  delete(): Promise<void>;
}

export interface MacOSKeychainOptions {
  executablePath?: string;
  service?: string;
  account?: string;
  trustedApplicationPath?: string;
  timeoutMs?: number;
}

interface CommandResult {
  code: number;
  stdout: string;
}

function safeEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? 'production',
    NO_COLOR: '1',
  };
  for (const key of ['HOME', 'LANG', 'LC_ALL', 'LOGNAME', 'PATH', 'TMPDIR', 'USER'] as const) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }
  return environment;
}

export class MacOSKeychainSecretStore implements KeychainSecretStore {
  private readonly options: z.infer<typeof optionsSchema>;

  constructor(options: MacOSKeychainOptions = {}) {
    this.options = optionsSchema.parse(options);
  }

  async get(): Promise<string | null> {
    const result = await this.run([
      'find-generic-password',
      '-a',
      this.options.account,
      '-s',
      this.options.service,
      '-w',
    ]);
    if (result.code === ITEM_NOT_FOUND_EXIT_CODE) return null;
    if (result.code !== 0) throw new Error('macOS Keychain read failed');
    return result.stdout.replace(/\r?\n$/, '');
  }

  async set(value: string): Promise<void> {
    if (!value || Buffer.byteLength(value, 'utf8') > MAX_SECRET_BYTES) {
      throw new Error('macOS Keychain value is invalid');
    }
    const result = await this.run(
      [
        'add-generic-password',
        '-a',
        this.options.account,
        '-s',
        this.options.service,
        '-U',
        '-T',
        this.options.trustedApplicationPath,
        '-w',
      ],
      value,
    );
    if (result.code !== 0) throw new Error('macOS Keychain write failed');
  }

  async delete(): Promise<void> {
    const result = await this.run([
      'delete-generic-password',
      '-a',
      this.options.account,
      '-s',
      this.options.service,
    ]);
    if (result.code !== 0 && result.code !== ITEM_NOT_FOUND_EXIT_CODE) {
      throw new Error('macOS Keychain delete failed');
    }
  }

  private run(args: string[], input?: string): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const environment = safeEnvironment();
      const workingDirectory = environment.HOME;
      if (!workingDirectory || !isAbsolute(workingDirectory)) {
        reject(new Error('macOS Keychain requires an absolute home directory'));
        return;
      }
      const child: ChildProcessWithoutNullStreams = spawn(this.options.executablePath, args, {
        cwd: workingDirectory,
        env: environment,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const chunks: Buffer[] = [];
      let outputBytes = 0;
      let settled = false;

      const wipeChunks = () => {
        for (const stored of chunks) stored.fill(0);
        chunks.length = 0;
      };
      const terminate = () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        child.kill('SIGTERM');
        const forceTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        }, 250);
        forceTimer.unref();
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
          reject(new Error('macOS Keychain operation timed out'));
        });
      }, this.options.timeoutMs);
      timer.unref();

      child.stderr.resume();
      child.on('error', () => {
        finish(() => {
          wipeChunks();
          reject(new Error('macOS Keychain executable could not be started'));
        });
      });
      child.stdin.on('error', () => {
        finish(() => {
          wipeChunks();
          terminate();
          reject(new Error('macOS Keychain input stream closed'));
        });
      });
      child.stdout.on('data', (chunk: Buffer) => {
        if (settled) return;
        outputBytes += chunk.length;
        if (outputBytes > MAX_SECRET_BYTES) {
          finish(() => {
            wipeChunks();
            terminate();
            reject(new Error('macOS Keychain output exceeded the size limit'));
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
      else child.stdin.end(`${input}\n`, 'utf8');
    });
  }
}
