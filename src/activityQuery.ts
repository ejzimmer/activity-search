import { parseCoordinates, type Coordinates } from '../lib/coordinates.ts';

/** What's typed into the filter form, kept as text so a half-typed value survives a round trip through the URL. */
export interface FilterValues {
  sportType: string;
  name: string;
  distanceKm: string;
  hours: string;
  minutes: string;
  nearLat: string;
  nearLng: string;
}

export const NO_FILTERS: FilterValues = {
  sportType: '',
  name: '',
  distanceKm: '',
  hours: '',
  minutes: '',
  nearLat: '',
  nearLng: '',
};

export interface ActivityQuery {
  page: number;
  filters: FilterValues;
}

const FILTER_PARAMS: Record<keyof FilterValues, string> = {
  sportType: 'type',
  name: 'name',
  distanceKm: 'km',
  hours: 'hours',
  minutes: 'minutes',
  nearLat: 'lat',
  nearLng: 'lng',
};

export function readActivityQuery(params: URLSearchParams): ActivityQuery {
  const page = Number(params.get('page'));
  const filterEntries = Object.entries(FILTER_PARAMS).map(([field, param]) => [
    field,
    params.get(param) ?? '',
  ]);
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    filters: Object.fromEntries(filterEntries) as FilterValues,
  };
}

export function writeActivityQuery(url: URL, { page, filters }: ActivityQuery) {
  url.searchParams.set('page', String(page));
  for (const [field, param] of Object.entries(FILTER_PARAMS)) {
    const value = filters[field as keyof FilterValues];
    if (value) url.searchParams.set(param, value);
    else url.searchParams.delete(param);
  }
}

function parseWholeNumber(text: string): number | null {
  const value = Number(text);
  return text.trim() && Number.isInteger(value) && value >= 0 ? value : null;
}

function convertDurationToSeconds(hours: string, minutes: string) {
  const duration = Temporal.Duration.from({
    hours: parseWholeNumber(hours) ?? 0,
    minutes: parseWholeNumber(minutes) ?? 0,
  });
  return duration.total('seconds');
}

/** Five decimal places is about a metre, which is closer than GPS can place a run's start. */
function formatCoordinate(coordinate: number) {
  return coordinate.toFixed(5);
}

export function createNearFilterValues({
  lat,
  lng,
}: Coordinates): Pick<FilterValues, 'nearLat' | 'nearLng'> {
  return { nearLat: formatCoordinate(lat), nearLng: formatCoordinate(lng) };
}

export function readNearPoint(filters: FilterValues): Coordinates | null {
  return parseCoordinates(filters.nearLat, filters.nearLng);
}

/** The API takes distance in metres and duration in seconds. */
export function createApiSearchParams({
  page,
  filters,
}: ActivityQuery): URLSearchParams {
  const params = new URLSearchParams({ page: String(page) });
  if (filters.sportType) params.set('type', filters.sportType);
  if (filters.name.trim()) params.set('name', filters.name.trim());
  const distanceKm = Number(filters.distanceKm);
  if (filters.distanceKm.trim() && distanceKm > 0)
    params.set('distance', String(distanceKm * 1000));
  const durationSeconds = convertDurationToSeconds(
    filters.hours,
    filters.minutes,
  );
  if (durationSeconds > 0) params.set('duration', String(durationSeconds));
  const nearPoint = readNearPoint(filters);
  if (nearPoint) {
    params.set('lat', String(nearPoint.lat));
    params.set('lng', String(nearPoint.lng));
  }
  return params;
}

export function hasActiveFilters(query: ActivityQuery): boolean {
  return [...createApiSearchParams(query).keys()].some(
    (param) => param !== 'page',
  );
}
