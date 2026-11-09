/**
 * Pulls activities from Garmin Connect into the activities table.
 *
 *   npm run sync            # first run: everything; later runs: just what's new
 *   npm run sync -- --full  # re-fetch every activity summary
 *
 * Needs GARMIN_PERSONAL_API_KEY (create one at
 * https://connect.garmin.com/app/settings/personalApiToken) and DATABASE_URL.
 * Safe to re-run: activities are upserted by Garmin activity id, and each
 * activity file is only downloaded once.
 */
import 'dotenv/config'
import { getSql } from '../lib/db.ts'
import { GarminApiError, GarminClient, rowFromGarmin, type ActivityRow } from '../lib/garmin.ts'
import { pointsFromZip, summariseTrack } from '../lib/tracks.ts'

const PAGE_SIZE = 100
const full = process.argv.includes('--full')

const apiKey = process.env.GARMIN_PERSONAL_API_KEY
if (!apiKey) {
  console.error('Set GARMIN_PERSONAL_API_KEY in .env (see README).')
  process.exit(1)
}

const garmin = new GarminClient({ apiKey, baseUrl: process.env.GARMIN_PERSONAL_API_BASE_URL })
const sql = getSql()

// 1. Activity summaries
const [{ latest }] = (await sql`SELECT max(start_date) AS latest FROM activities`) as [{ latest: Date | null }]
let startDate: string | undefined
if (latest && !full) {
  // Go back a couple of days so late uploads and edits are picked up too.
  startDate = new Date(new Date(latest).getTime() - 2 * 86_400_000).toISOString().slice(0, 10)
  console.log(`Fetching activities since ${startDate}`)
} else {
  console.log('Fetching all activities')
}

let saved = 0
for (let start = 0; ; start += PAGE_SIZE) {
  const page = await garmin.searchActivities({ start, limit: PAGE_SIZE, startDate })
  const rows: ActivityRow[] = []
  for (const a of page) {
    try {
      rows.push(rowFromGarmin(a))
    } catch (err) {
      console.warn(`Skipping activity: ${(err as Error).message}`)
    }
  }
  if (rows.length) await upsert(rows)
  saved += rows.length
  console.log(`  saved ${saved} activities`)
  if (page.length < PAGE_SIZE) break
}

// 2. Routes, from the original activity files
const pending = (await sql`
  SELECT id::text FROM activities
  WHERE track_checked_at IS NULL
    AND (start_lat IS NOT NULL OR raw->>'hasPolyline' IS DISTINCT FROM 'false')
  ORDER BY start_date DESC
`) as Array<{ id: string }>
console.log(`Reading routes for ${pending.length} activities`)

let withRoute = 0
for (const [i, { id }] of pending.entries()) {
  try {
    const summary = summariseTrack(await pointsFromZip(await garmin.downloadActivity(id)))
    if (summary) withRoute++
    await sql`
      UPDATE activities SET
        summary_polyline = ${summary?.summary_polyline ?? null},
        start_lat = COALESCE(start_lat, ${summary?.start_lat ?? null}),
        start_lng = COALESCE(start_lng, ${summary?.start_lng ?? null}),
        end_lat = COALESCE(end_lat, ${summary?.end_lat ?? null}),
        end_lng = COALESCE(end_lng, ${summary?.end_lng ?? null}),
        track_checked_at = now()
      WHERE id = ${id}
    `
  } catch (err) {
    // A 4xx means this file won't ever work (e.g. no original file); don't keep retrying it.
    if (err instanceof GarminApiError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 429) {
      await sql`UPDATE activities SET track_checked_at = now() WHERE id = ${id}`
    }
    console.warn(`Couldn't read route for ${id}: ${(err as Error).message}`)
    if (err instanceof GarminApiError && err.status === 401) {
      console.error('Garmin rejected the API key. It may have expired; create a new one and re-run.')
      process.exit(1)
    }
  }
  if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${pending.length}`)
}
console.log(`Done. ${withRoute} new routes.`)

async function upsert(rows: ActivityRow[]) {
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
  )
}
