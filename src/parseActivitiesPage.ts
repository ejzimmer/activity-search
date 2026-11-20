import polyline from '@mapbox/polyline';
import type { ActivitiesPageResponse, ActivityResponse } from '../lib/types.ts';
import type { ActivitiesPage, Activity, LatLng } from './types.ts';

function parseInstant(value: string | null): Temporal.Instant | null {
  return value === null ? null : Temporal.Instant.from(value);
}

function decodeRoute({
  sport_type,
  summary_polyline,
}: ActivityResponse): LatLng[] | null {
  // Virtual rides and runs record GPS from a game world placed somewhere
  // real (Zwift's Watopia sits in the Pacific), so their routes are left off.
  if (!summary_polyline || sport_type?.startsWith('virtual_')) return null;
  return polyline.decode(summary_polyline) as LatLng[];
}

function parseActivity(response: ActivityResponse): Activity {
  const { summary_polyline, ...activity } = response;
  return {
    ...activity,
    start_date: Temporal.Instant.from(activity.start_date),
    route: decodeRoute(response),
  };
}

export function parseActivitiesPage(
  response: ActivitiesPageResponse,
): ActivitiesPage {
  return {
    ...response,
    activities: response.activities.map(parseActivity),
    sync: response.sync && {
      ...response.sync,
      last_started_at: parseInstant(response.sync.last_started_at),
      last_finished_at: parseInstant(response.sync.last_finished_at),
    },
  };
}
