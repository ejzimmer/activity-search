import polyline from '@mapbox/polyline';
import type { ActivitiesPageResponse, ActivityResponse } from '../lib/types.ts';
import type { ActivitiesPage, Activity, LatLng } from './types.ts';

function parseInstant(value: string | null): Temporal.Instant | null {
  return value === null ? null : Temporal.Instant.from(value);
}

function decodeRoute(summaryPolyline: string | null): LatLng[] | null {
  if (!summaryPolyline) return null;
  return polyline.decode(summaryPolyline) as LatLng[];
}

function parseActivity({
  summary_polyline,
  ...activity
}: ActivityResponse): Activity {
  return {
    ...activity,
    start_date: Temporal.Instant.from(activity.start_date),
    route: decodeRoute(summary_polyline),
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
