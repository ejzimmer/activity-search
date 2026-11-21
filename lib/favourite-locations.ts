import type { Sql } from './db.ts';
import { parseNewFavouriteLocation } from './new-favourite-location.ts';
import type { SignedInUser } from './sessions.ts';
import type { FavouriteLocationResponse } from './types.ts';

export async function listFavouriteLocations(
  sql: Sql,
  user: SignedInUser,
): Promise<Response> {
  const rows = await sql`
    SELECT id, name, lat, lng FROM favourite_locations
    WHERE user_id = ${user.id}
    ORDER BY name, id
  `;
  return Response.json(rows as FavouriteLocationResponse[]);
}

export async function addFavouriteLocation(
  sql: Sql,
  request: Request,
  user: SignedInUser,
): Promise<Response> {
  const location = parseNewFavouriteLocation(
    await request.json().catch(() => null),
  );
  if (!location) return new Response(null, { status: 400 });
  const [row] = await sql`
    INSERT INTO favourite_locations (name, lat, lng, user_id)
    VALUES (${location.name}, ${location.lat}, ${location.lng}, ${user.id})
    RETURNING id, name, lat, lng
  `;
  return Response.json(row as FavouriteLocationResponse, { status: 201 });
}

export async function removeFavouriteLocation(
  sql: Sql,
  favouriteId: string,
  user: SignedInUser,
): Promise<Response> {
  if (!/^\d+$/.test(favouriteId)) return new Response(null, { status: 404 });
  const deleted = await sql`
    DELETE FROM favourite_locations
    WHERE id = ${favouriteId} AND user_id = ${user.id}
    RETURNING id
  `;
  return new Response(null, { status: deleted.length > 0 ? 204 : 404 });
}
