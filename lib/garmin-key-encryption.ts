import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  hkdfSync,
} from 'node:crypto';

const CIPHER = 'aes-256-gcm';
const IV_BYTES = 12;

export class GarminKeyEncryption {
  private readonly encryptionKey: Buffer;

  constructor(private readonly secret: string) {
    if (!secret) throw new Error('The Garmin key encryption secret is empty');
    this.encryptionKey = Buffer.from(
      hkdfSync('sha256', secret, '', 'activity-search garmin keys', 32),
    );
  }

  encryptGarminKey(garminKey: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(CIPHER, this.encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(garminKey, 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), ciphertext]
      .map((part) => part.toString('base64'))
      .join('.');
  }

  decryptGarminKey(encryptedKey: string): string {
    const [iv, authTag, ciphertext] = encryptedKey
      .split('.')
      .map((part) => Buffer.from(part, 'base64'));
    const decipher = createDecipheriv(CIPHER, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Lets the function call itself to sync one user, without anyone else being able to. */
  createSyncToken(userId: number): string {
    return createHmac('sha256', this.secret)
      .update(`sync:${userId}`)
      .digest('base64url');
  }
}
