import type { Sql } from './db.ts';
import { GarminApiError } from './garmin.ts';
import type { GarminKeyEncryption } from './garmin-key-encryption.ts';
import { respondWithProblem } from './problem-response.ts';
import type { SignedInUser } from './sessions.ts';
import type { GarminKeyResponse } from './types.ts';

const MAX_GARMIN_KEY_LENGTH = 2000;

export interface GarminKeyServices {
  encryption: GarminKeyEncryption;
  checkGarminKey: (garminKey: string) => Promise<void>;
  startSyncForUser: (userId: number) => void;
}

export function parseGarminKeyRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { garminKey } = body as Record<string, unknown>;
  const trimmedKey = typeof garminKey === 'string' ? garminKey.trim() : '';
  if (!trimmedKey || trimmedKey.length > MAX_GARMIN_KEY_LENGTH) return null;
  return trimmedKey;
}

function isKeyRejection(error: unknown): boolean {
  return (
    error instanceof GarminApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  );
}

export async function saveGarminKey(
  sql: Sql,
  request: Request,
  user: SignedInUser,
  { encryption, checkGarminKey, startSyncForUser }: GarminKeyServices,
): Promise<Response> {
  const garminKey = parseGarminKeyRequest(
    await request.json().catch(() => null),
  );
  if (!garminKey) return respondWithProblem(400, 'Paste in your Garmin key.');

  try {
    await checkGarminKey(garminKey);
  } catch (error) {
    if (isKeyRejection(error))
      return respondWithProblem(
        400,
        "Garmin didn't accept that key. Check you copied all of it.",
      );
    console.error('Checking a Garmin key failed', error);
    return respondWithProblem(
      502,
      "Couldn't reach Garmin to check the key. Try again later.",
    );
  }

  const [saved] = await sql`
    UPDATE users SET
      garmin_key_encrypted = ${encryption.encryptGarminKey(garminKey)},
      garmin_key_saved_at = now(),
      is_garmin_key_rejected = false
    WHERE id = ${user.id}
    RETURNING garmin_key_saved_at AS "savedAt"
  `;
  startSyncForUser(user.id);
  const body: GarminKeyResponse = {
    savedAt: saved.savedAt as string,
    isRejected: false,
  };
  return Response.json(body);
}

export async function removeGarminKey(
  sql: Sql,
  user: SignedInUser,
): Promise<Response> {
  await sql`
    UPDATE users SET
      garmin_key_encrypted = NULL,
      garmin_key_saved_at = NULL,
      is_garmin_key_rejected = false
    WHERE id = ${user.id}
  `;
  return new Response(null, { status: 204 });
}

export function startSyncNow(
  user: SignedInUser,
  startSyncForUser: (userId: number) => void,
): Response {
  if (!user.garminKey)
    return respondWithProblem(409, 'Add your Garmin key first.');
  startSyncForUser(user.id);
  return new Response(null, { status: 202 });
}
