/** The JSON the API sends. Dates and times are ISO 8601 instants, since JSON has no date type. */
export interface ActivityResponse {
  id: string; // BIGINT comes back as a string; keep it that way to avoid precision loss
  name: string;
  sport_type: string | null;
  start_date: string;
  distance_m: number | null;
  moving_time_s: number | null;
  elapsed_time_s: number | null;
  elevation_gain_m: number | null;
  start_lat: number | null;
  start_lng: number | null;
  summary_polyline: string | null;
}

export interface SyncStatusResponse {
  last_started_at: string | null;
  last_finished_at: string | null;
  last_result: string | null;
  running: boolean;
}

export interface ActivitiesPageResponse {
  activities: ActivityResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sync: SyncStatusResponse | null;
}
