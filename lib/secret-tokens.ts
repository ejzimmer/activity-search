import { createHash, randomBytes } from 'node:crypto';

/** Session tokens and invite codes are stored only as hashes, so a leaked database can't be used to sign in. */
export function hashSecretToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function createSecretToken(): string {
  return randomBytes(32).toString('base64url');
}
