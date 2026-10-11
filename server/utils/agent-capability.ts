import { createHmac, timingSafeEqual } from 'node:crypto';

type CapabilityPayload = {
  userId: string;
  scope: 'read' | 'write';
  expiresAt: number;
  proposalId?: string;
  connectionUpdatedAt: string;
};

const encode = (value: CapabilityPayload) => Buffer.from(JSON.stringify(value)).toString('base64url');

export const mintAgentCapability = (
  payload: Omit<CapabilityPayload, 'expiresAt'>,
  secret: string
) => {
  const body = encode({ ...payload, expiresAt: Date.now() + 5 * 60_000 });
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
};

export const verifyAgentCapability = (token: string, secret: string): CapabilityPayload | null => {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (signature.length !== expected.length
    || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CapabilityPayload;
    return payload.expiresAt > Date.now() && (payload.scope === 'read' || payload.scope === 'write')
      ? payload
      : null;
  } catch {
    return null;
  }
};
