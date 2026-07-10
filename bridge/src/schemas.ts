import { z } from 'zod';

export const BRIDGE_PROTOCOL_VERSION = 1 as const;

const opaqueIdSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const sessionIdSchema = z.string().min(1).max(512);
const cursorSchema = z.string().min(1).max(4096);

export const bridgeMethodSchema = z.enum([
  'bridge.health',
  'session.list',
  'session.load',
  'session.prompt',
]);

export const bridgePermissionSchema = z.enum([
  'bridge:health',
  'session:metadata:read',
  'session:content:read',
  'session:prompt:send',
]);

export const signedRequestEnvelopeSchema = z
  .object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    bridgeId: opaqueIdSchema,
    deviceId: opaqueIdSchema,
    requestId: opaqueIdSchema,
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    nonce: z
      .string()
      .min(22)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
    method: bridgeMethodSchema,
    body: z.unknown(),
    signature: z
      .string()
      .min(80)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict()
  .superRefine((value, context) => {
    if (!Object.prototype.hasOwnProperty.call(value, 'body')) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Request body is required' });
    }
  });

export const bridgeHealthBodySchema = z.object({}).strict();

export const sessionListBodySchema = z
  .object({
    cursor: cursorSchema.optional(),
  })
  .strict();

export const sessionLoadBodySchema = z
  .object({
    sessionId: sessionIdSchema,
  })
  .strict();

export const sessionPromptBodySchema = z
  .object({
    sessionId: sessionIdSchema,
    text: z.string().min(1).max(100_000),
  })
  .strict();

export const deviceRecordSchema = z
  .object({
    bridgeId: opaqueIdSchema,
    deviceId: opaqueIdSchema,
    publicKeySpki: z
      .string()
      .min(32)
      .max(1024)
      .regex(/^[A-Za-z0-9_-]+$/),
    status: z.enum(['active', 'revoked']),
    permissions: z.array(bridgePermissionSchema).max(bridgePermissionSchema.options.length),
    allowedSessionIds: z.array(sessionIdSchema).max(10_000).optional(),
  })
  .strict();

export const bodySchemas = {
  'bridge.health': bridgeHealthBodySchema,
  'session.list': sessionListBodySchema,
  'session.load': sessionLoadBodySchema,
  'session.prompt': sessionPromptBodySchema,
} as const;

export const permissionByMethod = {
  'bridge.health': 'bridge:health',
  'session.list': 'session:metadata:read',
  'session.load': 'session:content:read',
  'session.prompt': 'session:prompt:send',
} as const satisfies Record<BridgeMethod, BridgePermission>;

export type BridgeMethod = z.infer<typeof bridgeMethodSchema>;
export type BridgePermission = z.infer<typeof bridgePermissionSchema>;
export type SignedRequestEnvelope = z.infer<typeof signedRequestEnvelopeSchema>;
export type DeviceRecord = z.infer<typeof deviceRecordSchema>;
export type BridgeHealthBody = z.infer<typeof bridgeHealthBodySchema>;
export type SessionListBody = z.infer<typeof sessionListBodySchema>;
export type SessionLoadBody = z.infer<typeof sessionLoadBodySchema>;
export type SessionPromptBody = z.infer<typeof sessionPromptBodySchema>;

export type BridgeBodyByMethod = {
  'bridge.health': BridgeHealthBody;
  'session.list': SessionListBody;
  'session.load': SessionLoadBody;
  'session.prompt': SessionPromptBody;
};
