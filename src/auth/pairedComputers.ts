import { z } from 'zod';

import { branding } from '@lib/branding';

import { deleteSecret, getSecret, storeSecret } from './keychain';

const base64UrlSchema = z
  .string()
  .min(32)
  .max(2048)
  .regex(/^[A-Za-z0-9_-]+$/);

const bridgePermissionSchema = z.enum([
  'bridge:health',
  'session:metadata:read',
  'session:content:read',
  'session:prompt:send',
]);

export const pairedComputerCredentialSchema = z
  .object({
    version: z.literal(1),
    bridgeId: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
    computerName: z.string().trim().min(1).max(80),
    endpoint: z
      .string()
      .url()
      .max(2048)
      .refine((value) => {
        try {
          const protocol = new URL(value).protocol;
          return protocol === 'https:' || protocol === 'wss:';
        } catch {
          return false;
        }
      }, 'Paired computer endpoint must use encrypted transport'),
    bridgePublicKeySpki: base64UrlSchema,
    bridgeKeyFingerprint: base64UrlSchema.length(43),
    deviceId: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
    devicePrivateKeyPkcs8: base64UrlSchema,
    devicePublicKeySpki: base64UrlSchema,
    permissions: z.array(bridgePermissionSchema).max(bridgePermissionSchema.options.length),
    pairedAt: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.permissions).size !== value.permissions.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Permissions must be unique' });
    }
  });

const pairedComputerListSchema = z
  .array(pairedComputerCredentialSchema)
  .max(8)
  .superRefine((value, context) => {
    const bridgeIds = value.map((computer) => computer.bridgeId);
    const deviceIds = value.map((computer) => computer.deviceId);
    if (new Set(bridgeIds).size !== bridgeIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Bridge IDs must be unique' });
    }
    if (new Set(deviceIds).size !== deviceIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Device IDs must be unique' });
    }
  });

export type PairedComputerCredential = z.infer<typeof pairedComputerCredentialSchema>;

export interface PairedComputerSummary {
  bridgeId: string;
  computerName: string;
  pairedAt: number;
  permissions: PairedComputerCredential['permissions'];
}

export async function loadPairedComputers(): Promise<PairedComputerCredential[]> {
  const stored = await getSecret(branding.keychain.pairedComputers);
  if (!stored) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new Error('Paired computer credentials are corrupted');
  }
  const result = pairedComputerListSchema.safeParse(parsed);
  if (!result.success) throw new Error('Paired computer credentials failed validation');
  return result.data;
}

export async function loadPairedComputerSummaries(): Promise<PairedComputerSummary[]> {
  const computers = await loadPairedComputers();
  return computers.map(({ bridgeId, computerName, pairedAt, permissions }) => ({
    bridgeId,
    computerName,
    pairedAt,
    permissions: [...permissions],
  }));
}

export async function storePairedComputers(input: unknown): Promise<void> {
  const computers = pairedComputerListSchema.parse(input);
  await storeSecret(branding.keychain.pairedComputers, JSON.stringify(computers));
}

export async function clearPairedComputers(): Promise<void> {
  await deleteSecret(branding.keychain.pairedComputers);
}
