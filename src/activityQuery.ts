/** What's typed into the filter form, kept as text so a half-typed value survives a round trip through the URL. */
export interface FilterValues {
  sportType: string;
  name: string;
  distanceKm: string;
  hours: string;
  minutes: string;
}

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
  return params;
}

export function hasActiveFilters(query: ActivityQuery): boolean {
  return [...createApiSearchParams(query).keys()].some(
    (param) => param !== 'page',
  );
}
