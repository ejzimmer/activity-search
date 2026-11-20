import { connectToDatabase } from './db.ts';
import { parseNewFavouriteLocation } from './new-favourite-location.ts';
import type { FavouriteLocationResponse } from './types.ts';

export async function listFavouriteLocations(): Promise<Response> {
  const sql = connectToDatabase();
  const rows = await sql`
    SELECT id, name, lat, lng FROM favourite_locations ORDER BY name, id
  `;
  return Response.json(rows as FavouriteLocationResponse[]);
}

export async function addFavouriteLocation(
  request: Request,
): Promise<Response> {
  const location = parseNewFavouriteLocation(
    await request.json().catch(() => null),
  );
  if (!location) return new Response(null, { status: 400 });
  const sql = connectToDatabase();
  const [row] = await sql`
    INSERT INTO favourite_locations (name, lat, lng)
    VALUES (${location.name}, ${location.lat}, ${location.lng})
    RETURNING id, name, lat, lng
  `;
  return Response.json(row as FavouriteLocationResponse, { status: 201 });
}

export async function removeFavouriteLocation(
  favouriteId: string,
): Promise<Response> {
  if (!/^\d+$/.test(favouriteId)) return new Response(null, { status: 404 });
  const sql = connectToDatabase();
  const deleted = await sql`
    DELETE FROM favourite_locations WHERE id = ${favouriteId} RETURNING id
  `;
  return new Response(null, { status: deleted.length > 0 ? 204 : 404 });
}
