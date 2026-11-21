import { functionBaseUrl } from '@neon/env';
import { waitUntil } from '@neon/functions';
import type { Sql } from './db.ts';
import { API_FUNCTION_SLUG } from './function-slugs.ts';
import { GarminClient } from './garmin.ts';
import type { GarminKeyEncryption } from './garmin-key-encryption.ts';
import { syncWithGarmin } from './sync.ts';

export function isScheduledSyncRequest(request: Request): boolean {
  // Neon strips X-Neon-* headers from outside requests, so only its scheduler
  // can send this one.
  return request.headers.has('x-neon-trigger-invocation-id');
}

export function readTrustedSyncUserId(
  request: Request,
  encryption: GarminKeyEncryption,
): number | null {
  const userId = Number(new URL(request.url).searchParams.get('user'));
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const token = request.headers.get('x-sync-token');
  return token === encryption.createSyncToken(userId) ? userId : null;
}

function startBackgroundSync(
  encryption: GarminKeyEncryption,
  userId: number,
): Promise<Response> {
  const url = new URL('/sync', functionBaseUrl(API_FUNCTION_SLUG));
  url.searchParams.set('user', String(userId));
  return fetch(url, {
    method: 'POST',
    headers: { 'x-sync-token': encryption.createSyncToken(userId) },
  });
}

/** Each user's sync runs in its own invocation, so one long history can't use up the others' time. */
async function startSyncForEveryone(
  sql: Sql,
  encryption: GarminKeyEncryption,
): Promise<void> {
  const users = (await sql`
    SELECT id FROM users
    WHERE garmin_key_encrypted IS NOT NULL AND NOT is_garmin_key_rejected
  `) as Array<{ id: number }>;
  for (const { id } of users) {
    const response = await startBackgroundSync(encryption, id);
    console.log(`Started the sync for user ${id}: ${response.status}`);
  }
}

export async function syncUserUntilDeadlineThenContinue(
  sql: Sql,
  encryption: GarminKeyEncryption,
  userId: number,
): Promise<void> {
  try {
    const [user] = (await sql`
      SELECT garmin_key_encrypted AS "encryptedKey" FROM users WHERE id = ${userId}
    `) as Array<{ encryptedKey: string | null }>;
    if (!user?.encryptedKey) return;
    const syncResult = await syncWithGarmin({
      sql,
      garmin: new GarminClient({
        apiKey: encryption.decryptGarminKey(user.encryptedKey),
      }),
      userId,
      // Leaves a margin under Neon's 15-minute limit for each invocation.
      deadline: Temporal.Now.instant().add({ minutes: 12 }),
    });
    if (syncResult.status === 'partial') {
      const response = await startBackgroundSync(encryption, userId);
      console.log(`Started the next part of the sync: ${response.status}`);
    }
  } catch (error) {
    console.error(`Sync failed for user ${userId}`, error);
  }
}

export function acceptSyncRequest(
  request: Request,
  sql: Sql,
  encryption: GarminKeyEncryption,
): Response {
  if (isScheduledSyncRequest(request)) {
    waitUntil(startSyncForEveryone(sql, encryption));
    return new Response(null, { status: 202 });
  }
  const userId = readTrustedSyncUserId(request, encryption);
  if (userId === null) return new Response(null, { status: 403 });
  waitUntil(syncUserUntilDeadlineThenContinue(sql, encryption, userId));
  return new Response(null, { status: 202 });
}
