/**
 * Runs a Garmin sync from your own machine (optional: Netlify runs it hourly).
 *
 *   npm run sync            # everything on the first run, then just what's new
 *   npm run sync -- --full  # re-fetch every activity summary
 *
 * Needs GARMIN_PERSONAL_API_KEY and DATABASE_URL in .env.
 */
import 'dotenv/config'
import { getSql } from '../lib/db.ts'
import { GarminClient } from '../lib/garmin.ts'
import { runSync } from '../lib/sync.ts'

const apiKey = process.env.GARMIN_PERSONAL_API_KEY
if (!apiKey) {
  console.error('Set GARMIN_PERSONAL_API_KEY in .env (see README).')
  process.exit(1)
}

await runSync({
  sql: getSql(),
  garmin: new GarminClient({ apiKey, baseUrl: process.env.GARMIN_PERSONAL_API_BASE_URL }),
  full: process.argv.includes('--full'),
})
