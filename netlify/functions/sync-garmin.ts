import type { Config } from '@netlify/functions'
import { getSql } from '../../lib/db.ts'
import { GarminClient } from '../../lib/garmin.ts'
import { runSync, syncToken } from '../../lib/sync.ts'

/**
 * POST /api/sync — the actual sync, run as a background function so it gets
 * up to 15 minutes. Started by the hourly `sync-schedule` function.
 */
export default async (req: Request): Promise<void> => {
  const apiKey = process.env.GARMIN_PERSONAL_API_KEY
  if (!apiKey) {
    console.error('GARMIN_PERSONAL_API_KEY is not set')
    return
  }
  if (req.headers.get('x-sync-token') !== syncToken(apiKey)) {
    console.warn('Ignoring sync request without a valid token')
    return
  }
  await runSync({
    sql: getSql(),
    garmin: new GarminClient({ apiKey }),
    full: new URL(req.url).searchParams.get('full') === '1',
    // Leave a margin under the 15-minute background function limit.
    deadline: Date.now() + 12 * 60_000,
  })
}

export const config: Config = {
  path: '/api/sync',
  method: 'POST',
  background: true,
}
