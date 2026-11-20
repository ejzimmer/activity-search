import { parseCoordinates } from './coordinates.ts';
import type { NewFavouriteLocation } from './types.ts';

export const MAX_FAVOURITE_NAME_LENGTH = 60;

export function parseNewFavouriteLocation(
  body: unknown,
): NewFavouriteLocation | null {
  if (typeof body !== 'object' || body === null) return null;
  const { name, lat, lng } = body as Record<string, unknown>;
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const coordinates = parseCoordinates(lat, lng);
  if (
    !coordinates ||
    !trimmedName ||
    trimmedName.length > MAX_FAVOURITE_NAME_LENGTH
  ) {
    return null;
  }
  return { name: trimmedName, ...coordinates };
}
