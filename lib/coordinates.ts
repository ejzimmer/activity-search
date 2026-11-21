export const NEAR_RADIUS_M = 500;

export interface Coordinates {
  lat: number;
  lng: number;
}

function readCoordinate(value: unknown, limit: number): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && Math.abs(coordinate) <= limit
    ? coordinate
    : null;
}

export function parseCoordinates(
  lat: unknown,
  lng: unknown,
): Coordinates | null {
  const latitude = readCoordinate(lat, 90);
  const longitude = readCoordinate(lng, 180);
  return latitude === null || longitude === null
    ? null
    : { lat: latitude, lng: longitude };
}
