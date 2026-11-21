// Neon Functions only offer Node 24, which doesn't have Temporal built in.
import 'temporal-polyfill/global';
import { routeApiRequest } from '../lib/api-routes.ts';
import { connectToDatabase } from '../lib/db.ts';
import { acceptSyncRequest } from '../lib/sync-request.ts';

export default async function respondToApiRequest(
  request: Request,
): Promise<Response> {
  if (request.method === 'POST' && new URL(request.url).pathname === '/sync') {
    return acceptSyncRequest(request);
  }
  return routeApiRequest(request, {
    sql: connectToDatabase(),
    setupInviteCode: process.env.SETUP_INVITE_CODE,
  });
}
