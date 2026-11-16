import { functionBaseUrl } from '@neon/env';
import { waitUntil } from '@neon/functions';
import { connectToDatabase } from './db.ts';
import { API_FUNCTION_SLUG } from './function-slugs.ts';
import { GarminClient } from './garmin.ts';
import {
  createSyncToken,
  startBackgroundSync,
  syncWithGarmin,
} from './sync.ts';

export function isTrustedSyncRequest(
  request: Request,
  apiKey: string,
): boolean {
  // Neon strips X-Neon-* headers from outside requests, so only its scheduler
  // can send this one.
  if (request.headers.has('x-neon-trigger-invocation-id')) return true;
  return request.headers.get('x-sync-token') === createSyncToken(apiKey);
}

export function acceptSyncRequest(request: Request): Response {
  const apiKey = process.env.GARMIN_PERSONAL_API_KEY;
  if (!apiKey) {
    console.error('GARMIN_PERSONAL_API_KEY is not set');
    return new Response(null, { status: 500 });
  }
  if (!isTrustedSyncRequest(request, apiKey)) {
    return new Response(null, { status: 403 });
  }
  waitUntil(syncUntilDeadlineThenContinue(apiKey));
  return new Response(null, { status: 202 });
}

async function syncUntilDeadlineThenContinue(apiKey: string): Promise<void> {
  try {
    const syncResult = await syncWithGarmin({
      sql: connectToDatabase(),
      garmin: new GarminClient({ apiKey }),
      // Leaves a margin under Neon's 15-minute limit for each invocation.
      deadline: Temporal.Now.instant().add({ minutes: 12 }),
    });
    if (syncResult.status === 'partial') {
      const response = await startBackgroundSync(
        functionBaseUrl(API_FUNCTION_SLUG),
        apiKey,
      );
      console.log(`Started the next part of the sync: ${response.status}`);
    }
  } catch (error) {
    console.error('Sync failed', error);
  }
}
