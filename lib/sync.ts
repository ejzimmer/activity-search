import { createHash } from 'node:crypto';
import type { Sql } from './db.ts';
import {
  GarminApiError,
  GarminClient,
  createActivityRow,
  type ActivityRow,
} from './garmin.ts';
import { ensureSchema } from './schema.ts';
import { readZipPoints, summariseTrack } from './tracks.ts';

const PAGE_SIZE = 100;

export interface SyncOptions {
  sql: Sql;
  garmin: GarminClient;
  full?: boolean;
  /** After this, the run stops starting new work. */
  deadline?: Temporal.Instant;
  log?: (message: string) => void;
}

export interface SyncResult {
  status: 'done' | 'partial' | 'skipped';
  activitiesSaved: number;
  routesSaved: number;
  routesRemaining: number;
  message: string;
}

export async function syncWithGarmin(
  options: SyncOptions,
): Promise<SyncResult> {
  const { sql, log = console.log } = options;
  await ensureSchema(sql);

  const lockMinutes = options.deadline
    ? Math.ceil(
        options.deadline.since(Temporal.Now.instant()).total('minutes'),
      ) + 2
    : 24 * 60;
  const claimed = await sql.query(
    `UPDATE sync_state SET locked_until = now() + make_interval(mins => $1), last_started_at = now()
     WHERE id = 1 AND (locked_until IS NULL OR locked_until < now()) RETURNING id`,
    [lockMinutes],
  );
  if ((claimed as unknown[]).length === 0) {
    const message = 'Another sync is already running';
    log(message);
    return {
      status: 'skipped',
      activitiesSaved: 0,
      routesSaved: 0,
      routesRemaining: 0,
      message,
    };
  }

  try {
    const result = await syncActivities({ ...options, log });
    await sql`UPDATE sync_state SET locked_until = NULL, last_finished_at = now(), last_result = ${result.message} WHERE id = 1`;
    return result;
  } catch (error) {
    const keyRejected =
      error instanceof GarminApiError &&
      (error.status === 401 || error.status === 403);
    const message = keyRejected
      ? 'Failed: Garmin rejected the API key. It may have expired; create a new one and update GARMIN_PERSONAL_API_KEY.'
      : `Failed: ${(error as Error).message}`;
    await sql`UPDATE sync_state SET locked_until = NULL, last_finished_at = now(), last_result = ${message} WHERE id = 1`;
    throw error;
  }
}

async function syncActivities({
  sql,
  garmin,
  full,
  deadline,
  log,
}: SyncOptions & { log: (message: string) => void }) {
  const isOutOfTime = () =>
    deadline !== undefined &&
    Temporal.Instant.compare(Temporal.Now.instant(), deadline) > 0;

  const [{ latestDay }] = (await sql`
    SELECT to_char(max(start_date) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "latestDay"
    FROM activities
  `) as [{ latestDay: string | null }];
  let startDate: string | undefined;
  if (latestDay && !full) {
    // Go back a couple of days so late uploads and edits are picked up too.
    startDate = Temporal.PlainDate.from(latestDay)
      .subtract({ days: 2 })
      .toString();
    log(`Fetching activities since ${startDate}`);
  } else {
    log('Fetching all activities');
  }

  let activitiesSaved = 0;
  for (let start = 0; ; start += PAGE_SIZE) {
    const page = await garmin.searchActivities({
      start,
      limit: PAGE_SIZE,
      startDate,
    });
    const rows: ActivityRow[] = [];
    for (const garminActivity of page) {
      try {
        rows.push(createActivityRow(garminActivity));
      } catch (error) {
        log(`Skipping activity: ${(error as Error).message}`);
      }
    }
    if (rows.length) await upsertActivities(sql, rows);
    activitiesSaved += rows.length;
    log(`  saved ${activitiesSaved} activities`);
    if (page.length < PAGE_SIZE || isOutOfTime()) break;
  }

  const pending = (await sql`
    SELECT id::text FROM activities
    WHERE track_checked_at IS NULL
      AND (start_lat IS NOT NULL OR raw->>'hasPolyline' IS DISTINCT FROM 'false')
    ORDER BY start_date DESC
  `) as Array<{ id: string }>;
  log(`Reading routes for ${pending.length} activities`);

  let routesSaved = 0;
  let checked = 0;
  for (const { id } of pending) {
    if (isOutOfTime()) break;
    checked++;
    try {
      const summary = summariseTrack(
        await readZipPoints(await garmin.downloadActivity(id)),
      );
      if (summary) routesSaved++;
      await sql`
        UPDATE activities SET
          summary_polyline = ${summary?.summary_polyline ?? null},
          start_lat = COALESCE(start_lat, ${summary?.start_lat ?? null}),
          start_lng = COALESCE(start_lng, ${summary?.start_lng ?? null}),
          end_lat = COALESCE(end_lat, ${summary?.end_lat ?? null}),
          end_lng = COALESCE(end_lng, ${summary?.end_lng ?? null}),
          track_checked_at = now()
        WHERE id = ${id}
      `;
    } catch (error) {
      if (
        error instanceof GarminApiError &&
        (error.status === 401 || error.status === 403)
      )
        throw error;
      // Any other 4xx means this file won't ever work (e.g. no original file); don't keep retrying it.
      if (
        error instanceof GarminApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429
      ) {
        await sql`UPDATE activities SET track_checked_at = now() WHERE id = ${id}`;
      }
      log(`Couldn't read route for ${id}: ${(error as Error).message}`);
    }
    if (checked % 50 === 0) log(`  ${checked}/${pending.length}`);
  }

  const routesRemaining = pending.length - checked;
  const status = routesRemaining > 0 ? 'partial' : 'done';
  const message =
    `Saved ${activitiesSaved} activities and ${routesSaved} routes` +
    (routesRemaining
      ? `; ${routesRemaining} routes left for the next sync`
      : '');
  log(message);
  return {
    status,
    activitiesSaved,
    routesSaved,
    routesRemaining,
    message,
  } satisfies SyncResult;
}

export function createSyncToken(apiKey: string): string {
  return createHash('sha256')
    .update(`activity-search sync:${apiKey}`)
    .digest('hex');
}

async function upsertActivities(sql: Sql, rows: ActivityRow[]) {
  await sql.query(
    `INSERT INTO activities (
       id, name, sport_type, description, location_name, start_date, start_date_local,
       distance_m, moving_time_s, elapsed_time_s, elevation_gain_m, average_speed_mps,
       max_speed_mps, average_heartrate, max_heartrate, calories,
       start_lat, start_lng, end_lat, end_lng, raw
     )
     SELECT
       id::bigint, name, sport_type, description, location_name, start_date, start_date_local,
       distance_m, moving_time_s, elapsed_time_s, elevation_gain_m, average_speed_mps,
       max_speed_mps, average_heartrate, max_heartrate, calories,
       start_lat, start_lng, end_lat, end_lng, raw
     FROM jsonb_to_recordset($1::jsonb) AS r(
       id text, name text, sport_type text, description text, location_name text,
       start_date timestamptz, start_date_local timestamp, distance_m float8,
       moving_time_s int, elapsed_time_s int, elevation_gain_m float8, average_speed_mps float8,
       max_speed_mps float8, average_heartrate float8, max_heartrate float8, calories float8,
       start_lat float8, start_lng float8, end_lat float8, end_lng float8, raw jsonb
     )
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, sport_type = EXCLUDED.sport_type, description = EXCLUDED.description,
       location_name = EXCLUDED.location_name, start_date = EXCLUDED.start_date,
       start_date_local = EXCLUDED.start_date_local, distance_m = EXCLUDED.distance_m,
       moving_time_s = EXCLUDED.moving_time_s, elapsed_time_s = EXCLUDED.elapsed_time_s,
       elevation_gain_m = EXCLUDED.elevation_gain_m, average_speed_mps = EXCLUDED.average_speed_mps,
       max_speed_mps = EXCLUDED.max_speed_mps, average_heartrate = EXCLUDED.average_heartrate,
       max_heartrate = EXCLUDED.max_heartrate, calories = EXCLUDED.calories,
       start_lat = COALESCE(EXCLUDED.start_lat, activities.start_lat),
       start_lng = COALESCE(EXCLUDED.start_lng, activities.start_lng),
       end_lat = COALESCE(EXCLUDED.end_lat, activities.end_lat),
       end_lng = COALESCE(EXCLUDED.end_lng, activities.end_lng),
       raw = EXCLUDED.raw, imported_at = now()`,
    [JSON.stringify(rows)],
  );
}
