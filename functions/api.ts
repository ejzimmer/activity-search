// Neon Functions only offer Node 24, which doesn't have Temporal built in.
import 'temporal-polyfill/global';
import { getActivitiesPage } from '../lib/activities.ts';
import {
  addFavouriteLocation,
  listFavouriteLocations,
  removeFavouriteLocation,
} from '../lib/favourite-locations.ts';
import { acceptSyncRequest } from '../lib/sync-request.ts';

export default async function respondToApiRequest(
  request: Request,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method === 'GET' && pathname === '/activities') {
    return getActivitiesPage(request);
  }
  if (request.method === 'POST' && pathname === '/sync') {
    return acceptSyncRequest(request);
  }
  if (pathname === '/favourite-locations') {
    if (request.method === 'GET') return listFavouriteLocations();
    if (request.method === 'POST') return addFavouriteLocation(request);
  }
  const favouriteId = pathname.match(/^\/favourite-locations\/([^/]+)$/)?.[1];
  if (request.method === 'DELETE' && favouriteId) {
    return removeFavouriteLocation(favouriteId);
  }
  return new Response(null, { status: 404 });
}
