import { describeSignedInUser, signIn, signOut, signUp } from './accounts.ts';
import { getActivitiesPage } from './activities.ts';
import type { Sql } from './db.ts';
import {
  addFavouriteLocation,
  listFavouriteLocations,
  removeFavouriteLocation,
} from './favourite-locations.ts';
import { createInvite } from './invites.ts';
import { respondWithProblem } from './problem-response.ts';
import { findSignedInUser } from './sessions.ts';

export interface ApiContext {
  sql: Sql;
  setupInviteCode?: string;
}

export async function routeApiRequest(
  request: Request,
  { sql, setupInviteCode }: ApiContext,
): Promise<Response> {
  const { method } = request;
  const { pathname } = new URL(request.url);

  if (method === 'POST' && pathname === '/sign-up')
    return signUp(sql, request, setupInviteCode);
  if (method === 'POST' && pathname === '/sign-in') return signIn(sql, request);
  if (method === 'POST' && pathname === '/sign-out')
    return signOut(sql, request);

  const user = await findSignedInUser(sql, request);
  if (!user) return respondWithProblem(401, 'Sign in to see this.');

  if (method === 'GET' && pathname === '/session')
    return Response.json(describeSignedInUser(user));
  if (method === 'GET' && pathname === '/activities')
    return getActivitiesPage(sql, request, user);
  if (method === 'POST' && pathname === '/invites')
    return createInvite(sql, user);
  if (pathname === '/favourite-locations') {
    if (method === 'GET') return listFavouriteLocations(sql, user);
    if (method === 'POST') return addFavouriteLocation(sql, request, user);
  }
  const favouriteId = pathname.match(/^\/favourite-locations\/([^/]+)$/)?.[1];
  if (method === 'DELETE' && favouriteId)
    return removeFavouriteLocation(sql, favouriteId, user);

  return new Response(null, { status: 404 });
}
