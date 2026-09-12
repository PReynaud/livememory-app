import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const PLACEHOLDER_SECRETS = new Set([
  '',
  'replace-with-32-byte-base64-key',
  'replace-with-high-entropy-secret',
  'replace-with-local-service-role-key'
]);

export type EncryptedAgentCredential = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export const resolveAgentEncryptionSecret = (dedicated: string, fallback: string) => {
  for (const candidate of [dedicated, fallback]) {
    const value = candidate.trim();
    if (!PLACEHOLDER_SECRETS.has(value)) return value;
  }
  throw new Error('Agent credential encryption is not configured.');
};

const encryptionKey = (secret: string) => {
  const value = secret.trim();
  if (PLACEHOLDER_SECRETS.has(value)) {
    throw new Error('Agent credential encryption is not configured.');
  }
  const key = Buffer.from(value, 'base64');
  if (key.length === 32) return key;
  return createHash('sha256').update(value).digest();
};

export const encryptAgentCredential = (
  plaintext: string,
  secret: string
): EncryptedAgentCredential => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  };
};

export const decryptAgentCredential = (
  encrypted: EncryptedAgentCredential,
  secret: string
) => {
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(secret),
    Buffer.from(encrypted.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
};
