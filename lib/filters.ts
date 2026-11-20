import { parseCoordinates, type Coordinates } from './coordinates.ts';
import { listSportTypesWithin } from './sport-types.ts';

export const DISTANCE_TOLERANCE = { under: 0.1, over: 0.1 };
export const MOVING_TIME_TOLERANCE = { under: 0.04, over: 0.08 };

export interface Range {
  min: number;
  max: number;
}

export interface ActivityFilters {
  sportTypes: string[] | null;
  namePattern: string | null;
  distanceRange: Range | null;
  movingTimeRange: Range | null;
  nearPoint: Coordinates | null;
}

function readTrimmedParam(params: URLSearchParams, name: string) {
  return params.get(name)?.trim() || null;
}

function readPositiveNumberParam(params: URLSearchParams, name: string) {
  const value = Number(readTrimmedParam(params, name) ?? Number.NaN);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function createToleranceRange(
  target: number | null,
  tolerance: { under: number; over: number },
): Range | null {
  if (target === null) return null;
  return {
    min: target * (1 - tolerance.under),
    max: target * (1 + tolerance.over),
  };
}

/** A case-insensitive LIKE pattern that matches the text anywhere, with LIKE's own wildcards escaped. */
function createContainsPattern(text: string | null): string | null {
  if (text === null) return null;
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

/** Distance is in metres and duration in seconds. */
export function parseActivityFilters(params: URLSearchParams): ActivityFilters {
  const sportType = readTrimmedParam(params, 'type');
  return {
    sportTypes: sportType === null ? null : listSportTypesWithin(sportType),
    namePattern: createContainsPattern(readTrimmedParam(params, 'name')),
    distanceRange: createToleranceRange(
      readPositiveNumberParam(params, 'distance'),
      DISTANCE_TOLERANCE,
    ),
    movingTimeRange: createToleranceRange(
      readPositiveNumberParam(params, 'duration'),
      MOVING_TIME_TOLERANCE,
    ),
    nearPoint: parseCoordinates(params.get('lat'), params.get('lng')),
  };
}
