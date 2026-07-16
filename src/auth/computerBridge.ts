import { z } from 'zod';

import { canonicalJson } from './canonicalJson';
import {
  createRequestIdentity,
  deleteDeviceIdentity,
  postPinnedBridgeJson,
  postTailnetBridgeJson,
  sign,
} from './deviceSigning';
import {
  loadPairedComputers,
  storePairedComputers,
  type PairedComputerCredential,
} from './pairedComputers';

const BRIDGE_PROTOCOL_VERSION = 2 as const;
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
const localSessionIdSchema = z.string().regex(/^local_[A-Za-z0-9_-]{43}$/);
const interactionIdSchema = z.string().regex(/^interaction_[A-Za-z0-9_-]{43}$/);
const workspaceIdSchema = z.string().regex(/^workspace_[A-Za-z0-9_-]{43}$/);
const modelIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9._:+-]+$/);
const computerModelSchema = z
  .object({
    id: modelIdSchema,
    name: z.string().min(1).max(160),
    description: z.string().min(1).max(500).optional(),
    supportsImages: z.boolean().optional(),
    badge: z.enum(['new', 'free_promo']).optional(),
    recent: z.boolean().default(false),
    recommended: z.boolean().default(false),
  })
  .strict();
const bridgeMethodSchema = z.enum([
  'bridge.health',
  'bridge.features',
  'bridge.version',
  'device.revoke',
  'session.list',
  'session.load',
  'session.activity',
  'session.elicitation',
  'session.elicitation.respond',
  'session.prompt',
  'session.create_options',
  'session.create',
]);
const bridgeHealthBodySchema = z.object({}).strict();
const bridgeFeaturesBodySchema = z.object({}).strict();
const bridgeVersionBodySchema = z.object({}).strict();
const computerBridgeFeaturesSchema = z
  .object({ sessionElicitation: z.boolean() })
  .strict();
export const computerBridgeVersionSchema = z
  .object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) })
  .strict();
const deviceRevokeBodySchema = z.object({}).strict();
const deviceRevokeResponseSchema = z.object({ revoked: z.literal(true) }).strict();
const sessionListBodySchema = z.object({ cursor: cursorSchema.optional() }).strict();
const sessionLoadBodySchema = z.object({ sessionId: localSessionIdSchema }).strict();
const sessionActivityBodySchema = z.object({ sessionId: localSessionIdSchema }).strict();
const computerSessionActivitySchema = z
  .object({
    active: z.boolean(),
    kind: z.enum([
      'thinking',
      'reading',
      'editing',
      'executing',
      'searching',
      'fetching',
      'responding',
    ]),
    label: z.string().min(1).max(160),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();
const sessionElicitationBodySchema = z.object({ sessionId: localSessionIdSchema }).strict();
const elicitationValueSchema = z.union([
  z.string().max(10_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(500)).max(100),
]);
const computerSessionElicitationSchema = z
  .object({
    interaction: z
      .object({
        id: interactionIdSchema,
        message: z.string().min(1).max(4_000),
        title: z.string().min(1).max(500).optional(),
        description: z.string().min(1).max(2_000).optional(),
        fields: z
          .array(
            z
              .object({
                key: z.string().min(1).max(160),
                type: z.enum([
                  'text',
                  'single_select',
                  'multi_select',
                  'number',
                  'integer',
                  'boolean',
                ]),
                title: z.string().min(1).max(500),
                description: z.string().min(1).max(2_000).optional(),
                required: z.boolean(),
                options: z
                  .array(
                    z
                      .object({ value: z.string().max(500), label: z.string().min(1).max(500) })
                      .strict(),
                  )
                  .max(100)
                  .optional(),
                minimum: z.number().finite().optional(),
                maximum: z.number().finite().optional(),
                minLength: z.number().int().min(0).max(10_000).optional(),
                maxLength: z.number().int().min(0).max(10_000).optional(),
                minItems: z.number().int().min(0).max(100).optional(),
                maxItems: z.number().int().min(0).max(100).optional(),
                defaultValue: elicitationValueSchema.optional(),
              })
              .strict(),
          )
          .min(1)
          .max(16),
        createdAt: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
  })
  .strict();
const sessionElicitationResponseBodySchema = z.union([
  z
    .object({
      sessionId: localSessionIdSchema,
      interactionId: interactionIdSchema,
      action: z.literal('accept'),
      content: z.record(elicitationValueSchema),
    })
    .strict(),
  z
    .object({
      sessionId: localSessionIdSchema,
      interactionId: interactionIdSchema,
      action: z.enum(['decline', 'cancel']),
    })
    .strict(),
]);
const sessionElicitationResponseSchema = z.object({ accepted: z.literal(true) }).strict();
const sessionPromptBodySchema = z
  .object({
    sessionId: localSessionIdSchema,
    text: z.string().trim().min(1).max(100_000),
    modelId: modelIdSchema.optional(),
  })
  .strict();
const sessionPromptResponseSchema = z
  .object({ accepted: z.literal(true), sessionId: localSessionIdSchema.optional() })
  .strict();
const sessionCreateOptionsBodySchema = z.object({}).strict();
const sessionCreateOptionsResponseSchema = z
  .object({
    workspaces: z
      .array(z.object({ id: workspaceIdSchema, name: z.string().min(1).max(160) }).strict())
      .max(100),
    models: z.array(computerModelSchema).max(200),
    defaultModelId: modelIdSchema.nullable().default(null),
    catalogSource: z.enum(['live', 'recent']).default('recent'),
  })
  .strict()
  .superRefine((value, context) => {
    const modelIds = value.models.map((model) => model.id);
    if (new Set(modelIds).size !== modelIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['models'],
        message: 'Model IDs must be unique',
      });
    }
    if (
      value.defaultModelId !== null &&
      !value.models.some((model) => model.id === value.defaultModelId && model.recommended)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultModelId'],
        message: 'Default model must be present and recommended',
      });
    }
  });
const sessionCreateBodySchema = z
  .object({
    workspaceId: workspaceIdSchema,
    modelId: modelIdSchema.nullable().optional(),
    text: z.string().trim().min(1).max(10_000),
  })
  .strict();
const sessionCreateResponseSchema = z
  .object({ accepted: z.literal(true), sessionId: localSessionIdSchema })
  .strict();

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
    id: localSessionIdSchema,
    origin: z.literal('computer'),
    workspaceName: z.string().min(1).max(160),
    hasTitle: z.boolean(),
    title: z.string().min(1).max(10_000).optional(),
    updatedAt: z.string().datetime({ offset: true }).optional(),
    model: computerModelSchema.optional(),
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

export const computerLoadedSessionSchema = z
  .object({
    session: z
      .object({
        id: localSessionIdSchema,
        origin: z.literal('computer'),
        workspaceName: z.string().min(1).max(160),
        model: computerModelSchema.optional(),
      })
      .strict(),
    messages: z
      .array(
        z
          .object({
            sequence: z.number().int().positive(),
            source: z.enum(['user', 'devin']),
            text: z.string().max(100_000),
          })
          .strict(),
      )
      .max(200),
    truncated: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    value.messages.forEach((message, index) => {
      if (message.sequence !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['messages', index, 'sequence'],
          message: 'Message sequence must be contiguous',
        });
      }
    });
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
export type ComputerBridgeFeatures = z.infer<typeof computerBridgeFeaturesSchema>;
export type ComputerBridgeVersionStatus =
  | { kind: 'supported'; version: string }
  | { kind: 'legacy' };
export type ComputerSessionSummary = z.infer<typeof computerSessionSummarySchema>;
export type ComputerSessionPage = z.infer<typeof computerSessionPageSchema>;
export type ComputerLoadedSession = z.infer<typeof computerLoadedSessionSchema>;
export type ComputerSessionActivity = z.infer<typeof computerSessionActivitySchema>;
export type ComputerSessionElicitation = z.infer<typeof computerSessionElicitationSchema>;
export type ComputerElicitationInteraction = NonNullable<ComputerSessionElicitation['interaction']>;
export type ComputerElicitationResponse = z.infer<typeof sessionElicitationResponseBodySchema>;
export type ComputerElicitationAnswer =
  | {
      interactionId: string;
      action: 'accept';
      content: Record<string, string | number | boolean | string[]>;
    }
  | { interactionId: string; action: 'decline' | 'cancel' };
export type ComputerCreateOptions = z.infer<typeof sessionCreateOptionsResponseSchema>;
export type ComputerModel = z.infer<typeof computerModelSchema>;

export type ComputerBridgeErrorCode =
  | 'not_paired'
  | 'permission_denied'
  | 'authorization_failed'
  | 'busy'
  | 'rate_limited'
  | 'unavailable'
  | 'unsupported_method'
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
  'bridge.features': 'bridge:health',
  'bridge.version': 'bridge:health',
  'device.revoke': 'bridge:health',
  'session.list': 'session:metadata:read',
  'session.load': 'session:content:read',
  'session.activity': 'session:content:read',
  'session.elicitation': 'session:content:read',
  'session.elicitation.respond': 'session:prompt:send',
  'session.prompt': 'session:prompt:send',
  'session.create_options': 'session:metadata:read',
  'session.create': 'session:create',
} as const satisfies Record<SupportedMethod, PairedComputerCredential['permissions'][number]>;

function bodyForMethod(method: SupportedMethod, input: unknown): object {
  if (method === 'bridge.health') return bridgeHealthBodySchema.parse(input);
  if (method === 'bridge.features') return bridgeFeaturesBodySchema.parse(input);
  if (method === 'bridge.version') return bridgeVersionBodySchema.parse(input);
  if (method === 'device.revoke') return deviceRevokeBodySchema.parse(input);
  if (method === 'session.list') return sessionListBodySchema.parse(input);
  if (method === 'session.load') return sessionLoadBodySchema.parse(input);
  if (method === 'session.activity') return sessionActivityBodySchema.parse(input);
  if (method === 'session.elicitation') return sessionElicitationBodySchema.parse(input);
  if (method === 'session.elicitation.respond') {
    return sessionElicitationResponseBodySchema.parse(input);
  }
  if (method === 'session.prompt') return sessionPromptBodySchema.parse(input);
  if (method === 'session.create_options') return sessionCreateOptionsBodySchema.parse(input);
  return sessionCreateBodySchema.parse(input);
}

function publicResponseError(status: number, method: SupportedMethod): ComputerBridgeError {
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
  if (status === 409) {
    return new ComputerBridgeError('Devin is finishing the previous turn.', 'busy');
  }
  if (status === 503) {
    return new ComputerBridgeError('The paired Mac is temporarily unavailable.', 'unavailable');
  }
  if (status === 400 && method === 'bridge.version') {
    return new ComputerBridgeError(
      'The paired Mac does not support version negotiation.',
      'unsupported_method',
    );
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
  if (
    method !== 'session.prompt' &&
    method !== 'session.elicitation.respond' &&
    method !== 'session.create' &&
    !credential.permissions.includes(requiredPermission)
  ) {
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
    const response =
      credential.transportSecurity === 'tailscale_wireguard'
        ? await postTailnetBridgeJson(credential.endpoint, '/v1/request', envelope)
        : await postPinnedBridgeJson(
            credential.endpoint,
            '/v1/request',
            credential.tlsCertificateFingerprint,
            envelope,
          );
    if (response.status !== 200) throw publicResponseError(response.status, method);
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

async function requestFeatures(
  credential: PairedComputerCredential,
): Promise<ComputerBridgeFeatures> {
  try {
    const response = await requestComputer(credential, 'bridge.features', {});
    const result = computerBridgeFeaturesSchema.safeParse(response.body);
    if (!result.success) {
      throw new ComputerBridgeError(
        'The paired Mac returned invalid feature information.',
        'invalid_response',
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof ComputerBridgeError && error.code === 'invalid_response') {
      return { sessionElicitation: false };
    }
    throw error;
  }
}

async function requestVersion(
  credential: PairedComputerCredential,
): Promise<ComputerBridgeVersionStatus> {
  try {
    const response = await requestComputer(credential, 'bridge.version', {});
    const result = computerBridgeVersionSchema.safeParse(response.body);
    if (!result.success) {
      throw new ComputerBridgeError(
        'The paired Mac returned invalid version information.',
        'invalid_response',
      );
    }
    return { kind: 'supported', version: result.data.version };
  } catch (error) {
    if (error instanceof ComputerBridgeError && error.code === 'unsupported_method') {
      return { kind: 'legacy' };
    }
    throw error;
  }
}

async function requestDeviceRevocation(credential: PairedComputerCredential): Promise<void> {
  const response = await requestComputer(credential, 'device.revoke', {});
  if (!deviceRevokeResponseSchema.safeParse(response.body).success) {
    throw new ComputerBridgeError(
      'The paired Mac returned an invalid revocation response.',
      'invalid_response',
    );
  }
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

async function requestSessionLoad(
  credential: PairedComputerCredential,
  input: { sessionId: string },
): Promise<ComputerLoadedSession> {
  const body = sessionLoadBodySchema.parse(input);
  const response = await requestComputer(credential, 'session.load', body);
  const result = computerLoadedSessionSchema.safeParse(response.body);
  if (!result.success || result.data.session.id !== body.sessionId) {
    throw new ComputerBridgeError(
      'The paired Mac returned an invalid session history.',
      'invalid_response',
    );
  }
  return result.data;
}

async function requestSessionActivity(
  credential: PairedComputerCredential,
  input: { sessionId: string },
): Promise<ComputerSessionActivity> {
  const body = sessionActivityBodySchema.parse(input);
  const response = await requestComputer(credential, 'session.activity', body);
  const result = computerSessionActivitySchema.safeParse(response.body);
  if (!result.success) {
    throw new ComputerBridgeError(
      'The paired Mac returned invalid session activity.',
      'invalid_response',
    );
  }
  return result.data;
}

async function requestSessionElicitation(
  credential: PairedComputerCredential,
  input: { sessionId: string },
): Promise<ComputerSessionElicitation> {
  const body = sessionElicitationBodySchema.parse(input);
  const response = await requestComputer(credential, 'session.elicitation', body);
  const result = computerSessionElicitationSchema.safeParse(response.body);
  if (!result.success) {
    throw new ComputerBridgeError(
      'The paired Mac returned an invalid question.',
      'invalid_response',
    );
  }
  return result.data;
}

async function requestSessionElicitationResponse(
  credential: PairedComputerCredential,
  input: ComputerElicitationResponse,
): Promise<void> {
  const body = sessionElicitationResponseBodySchema.parse(input);
  const response = await requestComputer(credential, 'session.elicitation.respond', body);
  if (!sessionElicitationResponseSchema.safeParse(response.body).success) {
    throw new ComputerBridgeError(
      'The paired Mac returned an invalid question response.',
      'invalid_response',
    );
  }
}

async function requestSessionPrompt(
  credential: PairedComputerCredential,
  input: { sessionId: string; text: string; modelId?: string },
): Promise<void | { sessionId: string }> {
  const body = sessionPromptBodySchema.parse(input);
  const response = await requestComputer(credential, 'session.prompt', body);
  const result = sessionPromptResponseSchema.safeParse(response.body);
  if (!result.success) {
    throw new ComputerBridgeError(
      'The paired Mac returned an invalid steering response.',
      'invalid_response',
    );
  }
  return result.data.sessionId ? { sessionId: result.data.sessionId } : undefined;
}

async function requestSessionCreateOptions(
  credential: PairedComputerCredential,
): Promise<ComputerCreateOptions> {
  const response = await requestComputer(credential, 'session.create_options', {});
  const result = sessionCreateOptionsResponseSchema.safeParse(response.body);
  if (!result.success) {
    throw new ComputerBridgeError(
      'The paired Mac returned invalid session creation options.',
      'invalid_response',
    );
  }
  return result.data;
}

async function requestSessionCreate(
  credential: PairedComputerCredential,
  input: { workspaceId: string; modelId?: string | null; text: string },
): Promise<{ sessionId: string }> {
  const body = sessionCreateBodySchema.parse(input);
  const response = await requestComputer(credential, 'session.create', body);
  const result = sessionCreateResponseSchema.safeParse(response.body);
  if (!result.success) {
    throw new ComputerBridgeError(
      'The paired Mac returned an invalid created session.',
      'invalid_response',
    );
  }
  return { sessionId: result.data.sessionId };
}

export interface ComputerBridgeConnection {
  bridgeId: string;
  getHealth(): Promise<ComputerBridgeHealth>;
  getFeatures(): Promise<ComputerBridgeFeatures>;
  getVersion(): Promise<ComputerBridgeVersionStatus>;
  listSessions(input?: { cursor?: string }): Promise<ComputerSessionPage>;
  loadSession(sessionId: string): Promise<ComputerLoadedSession>;
  getSessionActivity(sessionId: string): Promise<ComputerSessionActivity>;
  getSessionElicitation(sessionId: string): Promise<ComputerSessionElicitation>;
  respondToSessionElicitation(input: ComputerElicitationResponse): Promise<void>;
  promptSession(
    sessionId: string,
    text: string,
    modelId?: string,
  ): Promise<void | { sessionId: string }>;
  getCreateOptions(): Promise<ComputerCreateOptions>;
  createSession(input: {
    workspaceId: string;
    modelId?: string | null;
    text: string;
  }): Promise<{ sessionId: string }>;
}

function connectionForCredential(credential: PairedComputerCredential): ComputerBridgeConnection {
  return {
    bridgeId: credential.bridgeId,
    getHealth: () => requestHealth(credential),
    getFeatures: () => requestFeatures(credential),
    getVersion: () => requestVersion(credential),
    listSessions: (input = {}) => requestSessionList(credential, input),
    loadSession: (sessionId) => requestSessionLoad(credential, { sessionId }),
    getSessionActivity: (sessionId) => requestSessionActivity(credential, { sessionId }),
    getSessionElicitation: (sessionId) => requestSessionElicitation(credential, { sessionId }),
    respondToSessionElicitation: (input) => requestSessionElicitationResponse(credential, input),
    promptSession: (sessionId, text, modelId) =>
      requestSessionPrompt(credential, {
        sessionId,
        text,
        ...(modelId ? { modelId } : {}),
      }),
    getCreateOptions: () => requestSessionCreateOptions(credential),
    createSession: (input) => requestSessionCreate(credential, input),
  };
}

export async function verifyComputerBridgeCredential(
  credentialInput: PairedComputerCredential,
): Promise<ComputerBridgeHealth> {
  return requestHealth(credentialInput);
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
    if (!credential || credential.transportSecurity !== 'tailscale_wireguard') {
      throw new ComputerBridgeError('This Mac is not paired through Tailscale.', 'not_paired');
    }
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

export async function getComputerBridgeFeatures(
  bridgeId: string,
): Promise<ComputerBridgeFeatures> {
  return (await openComputerBridge(bridgeId)).getFeatures();
}

export async function getComputerBridgeVersion(
  bridgeId: string,
): Promise<ComputerBridgeVersionStatus> {
  return (await openComputerBridge(bridgeId)).getVersion();
}

export async function listComputerSessions(
  bridgeId: string,
  input: { cursor?: string } = {},
): Promise<ComputerSessionPage> {
  return (await openComputerBridge(bridgeId)).listSessions(input);
}

export async function loadComputerSession(
  bridgeId: string,
  sessionId: string,
): Promise<ComputerLoadedSession> {
  return (await openComputerBridge(bridgeId)).loadSession(sessionId);
}

export async function getComputerSessionActivity(
  bridgeId: string,
  sessionId: string,
): Promise<ComputerSessionActivity> {
  return (await openComputerBridge(bridgeId)).getSessionActivity(sessionId);
}

export async function getComputerSessionElicitation(
  bridgeId: string,
  sessionId: string,
): Promise<ComputerSessionElicitation> {
  return (await openComputerBridge(bridgeId)).getSessionElicitation(sessionId);
}

export async function respondToComputerSessionElicitation(
  bridgeId: string,
  input: ComputerElicitationResponse,
): Promise<void> {
  return (await openComputerBridge(bridgeId)).respondToSessionElicitation(input);
}

export async function promptComputerSession(
  bridgeId: string,
  sessionId: string,
  text: string,
  modelId?: string,
): Promise<void | { sessionId: string }> {
  return (await openComputerBridge(bridgeId)).promptSession(sessionId, text, modelId);
}

export async function getComputerCreateOptions(bridgeId: string): Promise<ComputerCreateOptions> {
  return (await openComputerBridge(bridgeId)).getCreateOptions();
}

export async function createComputerSession(
  bridgeId: string,
  input: { workspaceId: string; modelId?: string | null; text: string },
): Promise<{ sessionId: string }> {
  return (await openComputerBridge(bridgeId)).createSession(input);
}

export async function disconnectComputer(bridgeIdInput: string): Promise<void> {
  const bridgeId = opaqueIdSchema.parse(bridgeIdInput);
  const computers = await validatedComputerRegistry();
  const computer = computers.find((candidate) => candidate.bridgeId === bridgeId);
  if (!computer || computer.transportSecurity !== 'tailscale_wireguard') {
    throw new ComputerBridgeError('This Mac is not paired through Tailscale.', 'not_paired');
  }
  try {
    await requestDeviceRevocation(computer);
  } catch (error) {
    if (!(error instanceof ComputerBridgeError) || error.code !== 'authorization_failed') {
      throw error;
    }
  }
  await storePairedComputers(computers.filter((candidate) => candidate.bridgeId !== bridgeId));
  await deleteDeviceIdentity(computer.deviceKeyId);
}

export async function removeComputerFromThisIPhone(bridgeIdInput: string): Promise<void> {
  const bridgeId = opaqueIdSchema.parse(bridgeIdInput);
  const computers = await validatedComputerRegistry();
  const computer = computers.find((candidate) => candidate.bridgeId === bridgeId);
  if (!computer || computer.transportSecurity !== 'tailscale_wireguard') {
    throw new ComputerBridgeError('This Mac is not paired through Tailscale.', 'not_paired');
  }
  await storePairedComputers(computers.filter((candidate) => candidate.bridgeId !== bridgeId));
  await deleteDeviceIdentity(computer.deviceKeyId);
}
