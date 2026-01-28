import 'server-only';

import crypto from 'crypto';

const ENCRYPTION_KEY_ENV = 'AI_ENCRYPTION_KEY';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

const getEncryptionKey = () => {
  const raw = process.env[ENCRYPTION_KEY_ENV];
  if (!raw) {
    throw new Error(`Missing required env var: ${ENCRYPTION_KEY_ENV}`);
  }

  const normalized = raw.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be a 64-character hex string (32 bytes)`);
  }

  return Buffer.from(normalized, 'hex');
};

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decrypt(value: string): string {
  const [ivB64, authTagB64, ciphertextB64] = value.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted payload format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

export function maskApiKey(key: string | null | undefined): string {
  const raw = (key ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 8) return `${raw.slice(0, 2)}****`;

  const last4 = raw.slice(-4);

  if (raw.startsWith('sk-')) {
    return `sk-****${last4}`;
  }

  const dashIndex = raw.indexOf('-');
  if (dashIndex > 0) {
    return `${raw.slice(0, dashIndex + 1)}****${last4}`;
  }

  return `${raw.slice(0, 2)}****${last4}`;
}

