import type { Config } from '@netlify/functions';
import { connectToDatabase } from '../../lib/db.ts';
import { GarminClient } from '../../lib/garmin.ts';
import { syncWithGarmin, createSyncToken } from '../../lib/sync.ts';

export default async function syncGarminInBackground(
  request: Request,
): Promise<void> {
  const apiKey = process.env.GARMIN_PERSONAL_API_KEY;
  if (!apiKey) {
    console.error('GARMIN_PERSONAL_API_KEY is not set');
    return;
  }
  // /api/sync is a public URL. Only something that can read
  // GARMIN_PERSONAL_API_KEY (the schedule function) can work out this token,
  // and the hash can't be turned back into the key.
  if (request.headers.get('x-sync-token') !== createSyncToken(apiKey)) {
    console.warn('Ignoring sync request without a valid token');
    return;
  }
  await syncWithGarmin({
    sql: connectToDatabase(),
    garmin: new GarminClient({ apiKey }),
    full: new URL(request.url).searchParams.get('full') === '1',
    // Leave a margin under the 15-minute background function limit.
    deadline: Temporal.Now.instant().add({ minutes: 12 }),
  });
}

export const config: Config = {
  path: '/api/sync',
  method: 'POST',
  // Netlify gives background functions 15 minutes instead of 30 seconds.
  background: true,
};
