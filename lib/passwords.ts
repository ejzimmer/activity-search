import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_COST = 2 ** 15;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;
const HASH_BYTES = 32;

function deriveScryptKey(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelism: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password.normalize('NFKC'),
      salt,
      HASH_BYTES,
      {
        N: cost,
        r: blockSize,
        p: parallelism,
        maxmem: 256 * cost * blockSize,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}

/** Stores the scrypt parameters with the hash, so they can be raised later without breaking existing passwords. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveScryptKey(
    password,
    salt,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELISM,
  );
  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function isPasswordCorrect(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const [scheme, cost, blockSize, parallelism, salt, expectedKey] =
    passwordHash.split('$');
  if (scheme !== 'scrypt' || !expectedKey) return false;
  const expected = Buffer.from(expectedKey, 'base64');
  const actual = await deriveScryptKey(
    password,
    Buffer.from(salt, 'base64'),
    Number(cost),
    Number(blockSize),
    Number(parallelism),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
