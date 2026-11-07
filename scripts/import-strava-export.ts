/**
 * Imports a Strava bulk export into the activities table.
 *
 *   npm run import -- /path/to/unzipped/export
 *
 * Safe to re-run: rows are upserted by Strava activity id.
 */
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parse } from 'csv-parse/sync'
import { getSql } from '../lib/db.ts'
import { pointsFromFile, rowFromCsv, summariseTrack, type ActivityRow, type TrackSummary } from '../lib/strava-export.ts'

const BATCH_SIZE = 200
const FILE_CONCURRENCY = 8

const exportDir = process.argv[2]
if (!exportDir) {
  console.error('Usage: npm run import -- /path/to/unzipped/strava/export')
  process.exit(1)
}
const root = resolve(exportDir)

const csv = await readFile(join(root, 'activities.csv'), 'utf8').catch(() => {
  console.error(`Couldn't find activities.csv in ${root}. Point this at the unzipped export folder.`)
  process.exit(1)
})
const [header, ...records] = parse(csv, { bom: true, relax_column_count: true, skip_empty_lines: true }) as string[][]

const rows: ActivityRow[] = []
for (const [i, values] of records.entries()) {
  try {
    rows.push(rowFromCsv(header, values))
  } catch (err) {
    console.warn(`Skipping CSV row ${i + 2}: ${(err as Error).message}`)
  }
}
console.log(`Read ${rows.length} activities from activities.csv`)

type FullRow = ActivityRow & Partial<TrackSummary>
const full: FullRow[] = new Array(rows.length)
let withTrack = 0
let trackErrors = 0
let next = 0

async function worker() {
  while (next < rows.length) {
    const i = next++
    const row = rows[i]
    full[i] = row
    if (!row.source_file) continue
    try {
      const contents = await readFile(join(root, row.source_file))
      const summary = summariseTrack(await pointsFromFile(row.source_file, contents))
      if (summary) {
        full[i] = { ...row, ...summary }
        withTrack++
      }
    } catch (err) {
      trackErrors++
      console.warn(`Couldn't read track for ${row.id} (${row.source_file}): ${(err as Error).message}`)
    }
    if ((i + 1) % 250 === 0) console.log(`  parsed ${i + 1}/${rows.length} track files`)
  }
}
await Promise.all(Array.from({ length: FILE_CONCURRENCY }, worker))
console.log(`Got coordinates for ${withTrack} activities (${trackErrors} track files failed)`)

const sql = getSql()
for (let i = 0; i < full.length; i += BATCH_SIZE) {
  const batch = full.slice(i, i + BATCH_SIZE)
  await sql.query(
    `INSERT INTO activities (
       id, name, sport_type, description, start_date, distance_m, moving_time_s, elapsed_time_s,
       elevation_gain_m, average_speed_mps, max_speed_mps, average_heartrate, max_heartrate,
       calories, commute, gear, start_lat, start_lng, end_lat, end_lng, summary_polyline,
       source_file, raw
     )
     SELECT
       id::bigint, name, sport_type, description, start_date, distance_m, moving_time_s, elapsed_time_s,
       elevation_gain_m, average_speed_mps, max_speed_mps, average_heartrate, max_heartrate,
       calories, commute, gear, start_lat, start_lng, end_lat, end_lng, summary_polyline,
       source_file, raw
     FROM jsonb_to_recordset($1::jsonb) AS r(
       id text, name text, sport_type text, description text, start_date timestamptz,
       distance_m float8, moving_time_s int, elapsed_time_s int, elevation_gain_m float8,
       average_speed_mps float8, max_speed_mps float8, average_heartrate float8, max_heartrate float8,
       calories float8, commute boolean, gear text, start_lat float8, start_lng float8,
       end_lat float8, end_lng float8, summary_polyline text, source_file text, raw jsonb
     )
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, sport_type = EXCLUDED.sport_type, description = EXCLUDED.description,
       start_date = EXCLUDED.start_date, distance_m = EXCLUDED.distance_m,
       moving_time_s = EXCLUDED.moving_time_s, elapsed_time_s = EXCLUDED.elapsed_time_s,
       elevation_gain_m = EXCLUDED.elevation_gain_m, average_speed_mps = EXCLUDED.average_speed_mps,
       max_speed_mps = EXCLUDED.max_speed_mps, average_heartrate = EXCLUDED.average_heartrate,
       max_heartrate = EXCLUDED.max_heartrate, calories = EXCLUDED.calories,
       commute = EXCLUDED.commute, gear = EXCLUDED.gear,
       start_lat = COALESCE(EXCLUDED.start_lat, activities.start_lat),
       start_lng = COALESCE(EXCLUDED.start_lng, activities.start_lng),
       end_lat = COALESCE(EXCLUDED.end_lat, activities.end_lat),
       end_lng = COALESCE(EXCLUDED.end_lng, activities.end_lng),
       summary_polyline = COALESCE(EXCLUDED.summary_polyline, activities.summary_polyline),
       source_file = EXCLUDED.source_file, raw = EXCLUDED.raw, imported_at = now()`,
    [JSON.stringify(batch)],
  )
  console.log(`  saved ${Math.min(i + BATCH_SIZE, full.length)}/${full.length}`)
}
console.log('Done.')
