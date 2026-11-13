import type { Config } from '@netlify/functions';
import { getSql } from '../../lib/db.ts';
import { GarminClient } from '../../lib/garmin.ts';
import { runSync, createSyncToken } from '../../lib/sync.ts';

/** A background function, so Netlify gives it 15 minutes instead of 30 seconds. */
export default async (req: Request): Promise<void> => {
  const apiKey = process.env.GARMIN_PERSONAL_API_KEY;
  if (!apiKey) {
    console.error('GARMIN_PERSONAL_API_KEY is not set');
    return;
  }
  if (req.headers.get('x-sync-token') !== createSyncToken(apiKey)) {
    console.warn('Ignoring sync request without a valid token');
    return;
  }
  await runSync({
    sql: getSql(),
    garmin: new GarminClient({ apiKey }),
    full: new URL(req.url).searchParams.get('full') === '1',
    // Leave a margin under the 15-minute background function limit.
    deadline: Date.now() + 12 * 60_000,
  });
};

export const config: Config = {
  path: '/api/sync',
  method: 'POST',
  background: true,
};
