import { z } from 'zod';

import { canonicalJson } from './canonicalJson';
import { createRequestIdentity, postPinnedBridgeJson, sign } from './deviceSigning';
import { loadPairedComputers, type PairedComputerCredential } from './pairedComputers';

const BRIDGE_PROTOCOL_VERSION = 1 as const;
const REQUEST_LIFETIME_MS = 15_000;

const opaqueIdSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const cursorSchema = z.string().min(1).max(4_096);
const bridgeIdListSchema = z
  .array(opaqueIdSchema)
  .min(1)
  .max(8)
  .superRefine((value, context) => {
    if (new Set(value).size !== value.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Bridge IDs must be unique' });
    }
  });
const bridgeMethodSchema = z.enum(['bridge.health', 'session.list']);
const bridgeHealthBodySchema = z.object({}).strict();
const sessionListBodySchema = z.object({ cursor: cursorSchema.optional() }).strict();

const unsignedRequestSchema = z
  .object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    bridgeId: opaqueIdSchema,
    deviceId: opaqueIdSchema,
    requestId: opaqueIdSchema,
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    nonce: z
      .string()
      .length(32)
      .regex(/^[A-Za-z0-9_-]+$/),
    method: bridgeMethodSchema,
    body: z.unknown(),
  })
  .strict();

const signedRequestSchema = unsignedRequestSchema
  .extend({
    signature: z
      .string()
      .length(86)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const computerBridgeHealthSchema = z
  .object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    status: z.literal('ready'),
    capabilities: z
      .object({
        sessionList: z.boolean(),
        sessionLoad: z.boolean(),
        sessionPrompt: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const computerSessionSummarySchema = z
  .object({
    id: z.string().regex(/^local_[A-Za-z0-9_-]{43}$/),
    origin: z.literal('computer'),
    workspaceName: z.string().min(1).max(160),
    hasTitle: z.boolean(),
    title: z.string().min(1).max(10_000).optional(),
    updatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.hasTitle && value.title !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['title'],
        message: 'A title cannot be returned when hasTitle is false',
      });
    }
  });

export const computerSessionPageSchema = z
  .object({
    sessions: z.array(computerSessionSummarySchema).max(5_000),
    nextCursor: cursorSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.sessions.map((session) => session.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Session IDs must be unique' });
    }
  });

export type ComputerBridgeHealth = z.infer<typeof computerBridgeHealthSchema>;
export type ComputerSessionSummary = z.infer<typeof computerSessionSummarySchema>;
export type ComputerSessionPage = z.infer<typeof computerSessionPageSchema>;

export type ComputerBridgeErrorCode =
  | 'not_paired'
  | 'permission_denied'
  | 'authorization_failed'
  | 'rate_limited'
  | 'unavailable'
  | 'invalid_response';

export class ComputerBridgeError extends Error {
  constructor(
    message: string,
    readonly code: ComputerBridgeErrorCode,
  ) {
    super(message);
    this.name = 'ComputerBridgeError';
  }
}

type SupportedMethod = z.infer<typeof bridgeMethodSchema>;

const permissionByMethod = {
  'bridge.health': 'bridge:health',
  'session.list': 'session:metadata:read',
} as const satisfies Record<SupportedMethod, PairedComputerCredential['permissions'][number]>;

function bodyForMethod(method: SupportedMethod, input: unknown): object {
  return method === 'bridge.health'
    ? bridgeHealthBodySchema.parse(input)
    : sessionListBodySchema.parse(input);
}

function publicResponseError(status: number): ComputerBridgeError {
  if (status === 404) {
    return new ComputerBridgeError(
      'This iPhone is no longer authorized by the paired Mac.',
      'authorization_failed',
    );
  }
  if (status === 429) {
    return new ComputerBridgeError(
      'The paired Mac is receiving requests too quickly.',
      'rate_limited',
    );
  }
  if (status === 503) {
    return new ComputerBridgeError('The paired Mac is temporarily unavailable.', 'unavailable');
  }
  return new ComputerBridgeError('The paired Mac rejected an invalid request.', 'invalid_response');
}

async function validatedComputerRegistry(): Promise<PairedComputerCredential[]> {
  let computers: PairedComputerCredential[];
  try {
    computers = await loadPairedComputers();
  } catch {
    throw new ComputerBridgeError('Paired Mac credentials could not be validated.', 'not_paired');
  }
  return computers;
}

async function requestComputer(
  credential: PairedComputerCredential,
  method: SupportedMethod,
  input: unknown,
): Promise<{ body: Record<string, unknown>; credential: PairedComputerCredential }> {
  const requiredPermission = permissionByMethod[method];
  if (!credential.permissions.includes(requiredPermission)) {
    throw new ComputerBridgeError(
      'This iPhone does not have permission for that Mac request.',
      'permission_denied',
    );
  }
  const body = bodyForMethod(method, input);
  const requestIdentity = await createRequestIdentity();
  const issuedAt = Date.now();
  const unsigned = unsignedRequestSchema.parse({
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    bridgeId: credential.bridgeId,
    deviceId: credential.deviceId,
    requestId: requestIdentity.requestId,
    issuedAt,
    expiresAt: issuedAt + REQUEST_LIFETIME_MS,
    nonce: requestIdentity.nonce,
    method,
    body,
  });
  const signature = await sign(credential.deviceKeyId, canonicalJson(unsigned));
  const envelope = signedRequestSchema.parse({ ...unsigned, signature });

  try {
    const response = await postPinnedBridgeJson(
      credential.endpoint,
      '/v1/request',
      credential.tlsCertificateFingerprint,
      envelope,
    );
    if (response.status !== 200) throw publicResponseError(response.status);
    return { body: response.body, credential };
  } catch (error) {
    if (error instanceof ComputerBridgeError) throw error;
    throw new ComputerBridgeError('The paired Mac could not be reached securely.', 'unavailable');
  }
}

async function requestHealth(credential: PairedComputerCredential): Promise<ComputerBridgeHealth> {
  const response = await requestComputer(credential, 'bridge.health', {});
  const result = computerBridgeHealthSchema.safeParse(response.body);
  if (!result.success) {
    throw new ComputerBridgeError(
      'The paired Mac returned an invalid health response.',
      'invalid_response',
    );
  }
  return result.data;
}

async function requestSessionList(
  credential: PairedComputerCredential,
  input: { cursor?: string } = {},
): Promise<ComputerSessionPage> {
  const body = sessionListBodySchema.parse(input);
  const response = await requestComputer(credential, 'session.list', body);
  const result = computerSessionPageSchema.safeParse(response.body);
  if (!result.success) {
    throw new ComputerBridgeError(
      'The paired Mac returned an invalid session list.',
      'invalid_response',
    );
  }
  if (
    !response.credential.permissions.includes('session:content:read') &&
    result.data.sessions.some((session) => session.title !== undefined)
  ) {
    throw new ComputerBridgeError(
      'The paired Mac returned session content outside the device grant.',
      'invalid_response',
    );
  }
  return result.data;
}

export interface ComputerBridgeConnection {
  bridgeId: string;
  getHealth(): Promise<ComputerBridgeHealth>;
  listSessions(input?: { cursor?: string }): Promise<ComputerSessionPage>;
}

function connectionForCredential(credential: PairedComputerCredential): ComputerBridgeConnection {
  return {
    bridgeId: credential.bridgeId,
    getHealth: () => requestHealth(credential),
    listSessions: (input = {}) => requestSessionList(credential, input),
  };
}

export async function openComputerBridges(
  bridgeIdsInput: string[],
): Promise<Map<string, ComputerBridgeConnection>> {
  const bridgeIds = bridgeIdListSchema.parse(bridgeIdsInput);
  const computers = await validatedComputerRegistry();
  const credentials = new Map(computers.map((computer) => [computer.bridgeId, computer]));
  const connections = new Map<string, ComputerBridgeConnection>();
  for (const bridgeId of bridgeIds) {
    const credential = credentials.get(bridgeId);
    if (!credential) throw new ComputerBridgeError('This Mac is not paired.', 'not_paired');
    connections.set(bridgeId, connectionForCredential(credential));
  }
  return connections;
}

export async function openComputerBridge(bridgeId: string): Promise<ComputerBridgeConnection> {
  const connections = await openComputerBridges([bridgeId]);
  const connection = connections.get(bridgeId);
  if (!connection) throw new ComputerBridgeError('This Mac is not paired.', 'not_paired');
  return connection;
}

export async function getComputerBridgeHealth(bridgeId: string): Promise<ComputerBridgeHealth> {
  return (await openComputerBridge(bridgeId)).getHealth();
}

export async function listComputerSessions(
  bridgeId: string,
  input: { cursor?: string } = {},
): Promise<ComputerSessionPage> {
  return (await openComputerBridge(bridgeId)).listSessions(input);
}
