import type { ActivitiesPageResponse } from '../lib/types.ts';
import type { ActivitiesPage } from './types.ts';

function parseInstant(value: string | null): Temporal.Instant | null {
  return value === null ? null : Temporal.Instant.from(value);
}

export function parseActivitiesPage(
  response: ActivitiesPageResponse,
): ActivitiesPage {
  return {
    ...response,
    activities: response.activities.map((activity) => ({
      ...activity,
      start_date: Temporal.Instant.from(activity.start_date),
    })),
    sync: response.sync && {
      ...response.sync,
      last_started_at: parseInstant(response.sync.last_started_at),
      last_finished_at: parseInstant(response.sync.last_finished_at),
    },
  };
}
