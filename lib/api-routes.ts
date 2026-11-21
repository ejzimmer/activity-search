import { describeSignedInUser, signIn, signOut, signUp } from './accounts.ts';
import { getActivitiesPage } from './activities.ts';
import type { Sql } from './db.ts';
import {
  addFavouriteLocation,
  listFavouriteLocations,
  removeFavouriteLocation,
} from './favourite-locations.ts';
import {
  removeGarminKey,
  saveGarminKey,
  startSyncNow,
  type GarminKeyServices,
} from './garmin-keys.ts';
import { createInvite } from './invites.ts';
import { createPasswordResetLink, resetPassword } from './password-resets.ts';
import { respondWithProblem } from './problem-response.ts';
import { findSignedInUser } from './sessions.ts';

export interface ApiContext {
  sql: Sql;
  setupInviteCode?: string;
  garminKeyServices: GarminKeyServices;
}

export async function routeApiRequest(
  request: Request,
  { sql, setupInviteCode, garminKeyServices }: ApiContext,
): Promise<Response> {
  const { method } = request;
  const { pathname } = new URL(request.url);

  if (method === 'POST' && pathname === '/sign-up')
    return signUp(sql, request, setupInviteCode);
  if (method === 'POST' && pathname === '/sign-in') return signIn(sql, request);
  if (method === 'POST' && pathname === '/sign-out')
    return signOut(sql, request);
  if (method === 'POST' && pathname === '/reset-password')
    return resetPassword(sql, request, setupInviteCode);

  const user = await findSignedInUser(sql, request);
  if (!user) return respondWithProblem(401, 'Sign in to see this.');

  if (method === 'GET' && pathname === '/session')
    return Response.json(describeSignedInUser(user));
  if (method === 'GET' && pathname === '/activities')
    return getActivitiesPage(sql, request, user);
  if (method === 'POST' && pathname === '/invites')
    return createInvite(sql, user);
  if (method === 'POST' && pathname === '/password-reset-links')
    return createPasswordResetLink(sql, request, user);
  if (pathname === '/garmin-key') {
    if (method === 'PUT')
      return saveGarminKey(sql, request, user, garminKeyServices);
    if (method === 'DELETE') return removeGarminKey(sql, user);
  }
  if (method === 'POST' && pathname === '/sync-now')
    return startSyncNow(user, garminKeyServices.startSyncForUser);
  if (pathname === '/favourite-locations') {
    if (method === 'GET') return listFavouriteLocations(sql, user);
    if (method === 'POST') return addFavouriteLocation(sql, request, user);
  }
  const favouriteId = pathname.match(/^\/favourite-locations\/([^/]+)$/)?.[1];
  if (method === 'DELETE' && favouriteId)
    return removeFavouriteLocation(sql, favouriteId, user);

  return new Response(null, { status: 404 });
}
