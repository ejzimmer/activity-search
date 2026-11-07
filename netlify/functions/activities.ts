import type { Config } from '@netlify/functions'
import { getSql } from '../../lib/db.ts'
import { parsePagination } from '../../lib/pagination.ts'
import type { Activity, ActivitiesPage } from '../../lib/types.ts'

/** GET /api/activities?page=1&pageSize=25 — newest first, no filtering yet. */
export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } })
  }

  const { page, pageSize, offset } = parsePagination(new URL(req.url).searchParams)
  const sql = getSql()

  const [rows, [{ count }]] = await Promise.all([
    sql`
      SELECT id::text, name, sport_type, start_date, distance_m, moving_time_s, elapsed_time_s,
             elevation_gain_m, start_lat, start_lng, summary_polyline
      FROM activities
      ORDER BY start_date DESC, id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    sql`SELECT count(*)::int AS count FROM activities`,
  ])

  const body: ActivitiesPage = {
    activities: rows as Activity[],
    page,
    pageSize,
    total: count as number,
    totalPages: Math.max(1, Math.ceil((count as number) / pageSize)),
  }
  return Response.json(body)
}

export const config: Config = {
  path: '/api/activities',
}
