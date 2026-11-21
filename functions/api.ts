// Neon Functions only offer Node 24, which doesn't have Temporal built in.
import 'temporal-polyfill/global';
import { waitUntil } from '@neon/functions';
import { routeApiRequest } from '../lib/api-routes.ts';
import { connectToDatabase } from '../lib/db.ts';
import { GarminClient } from '../lib/garmin.ts';
import { GarminKeyEncryption } from '../lib/garmin-key-encryption.ts';
import {
  acceptSyncRequest,
  syncUserUntilDeadlineThenContinue,
} from '../lib/sync-request.ts';

export default async function respondToApiRequest(
  request: Request,
): Promise<Response> {
  const sql = connectToDatabase();
  const encryption = new GarminKeyEncryption(
    process.env.GARMIN_KEY_ENCRYPTION_SECRET ?? '',
  );
  if (request.method === 'POST' && new URL(request.url).pathname === '/sync') {
    return acceptSyncRequest(request, sql, encryption);
  }
  return routeApiRequest(request, {
    sql,
    setupInviteCode: process.env.SETUP_INVITE_CODE,
    garminKeyServices: {
      encryption,
      checkGarminKey: (garminKey) =>
        new GarminClient({ apiKey: garminKey }).checkApiKey(),
      startSyncForUser: (userId) =>
        waitUntil(syncUserUntilDeadlineThenContinue(sql, encryption, userId)),
    },
  });
}
