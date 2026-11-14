import type {
  ActivitiesPageResponse,
  ActivityResponse,
  SyncStatusResponse,
} from '../lib/types.ts';

export type Activity = Omit<ActivityResponse, 'start_date'> & {
  start_date: Temporal.Instant;
};

export type SyncStatus = Omit<
  SyncStatusResponse,
  'last_started_at' | 'last_finished_at'
> & {
  last_started_at: Temporal.Instant | null;
  last_finished_at: Temporal.Instant | null;
};

export type ActivitiesPage = Omit<
  ActivitiesPageResponse,
  'activities' | 'sync'
> & {
  activities: Activity[];
  sync: SyncStatus | null;
};
