import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

export type EncryptedAgentCredential = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

const encryptionKey = (secret: string) => {
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32) {
    throw new Error('Agent credential encryption is not configured.');
  }
  return key;
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
