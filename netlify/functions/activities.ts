import type { Config } from '@netlify/functions';
import { getSql } from '../../lib/db.ts';
import { parsePagination } from '../../lib/pagination.ts';
import type { Activity, ActivitiesPage, SyncStatus } from '../../lib/types.ts';

export default async (req: Request): Promise<Response> => {
  const { page, pageSize, offset } = parsePagination(
    new URL(req.url).searchParams,
  );
  const sql = getSql();

  try {
    const [rows, [{ count }], [sync]] = await Promise.all([
      sql`
        SELECT id::text, name, sport_type, start_date, distance_m, moving_time_s, elapsed_time_s,
               elevation_gain_m, start_lat, start_lng, summary_polyline
        FROM activities
        ORDER BY start_date DESC, id DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`SELECT count(*)::int AS count FROM activities`,
      sql`
        SELECT last_started_at, last_finished_at, last_result,
               coalesce(locked_until > now(), false) AS running
        FROM sync_state WHERE id = 1
      `,
    ]);
    const total = count as number;
    const body: ActivitiesPage = {
      activities: rows as Activity[],
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      sync: (sync as SyncStatus | undefined) ?? null,
    };
    return Response.json(body);
  } catch (err) {
    // 42P01: the tables don't exist yet because the first sync hasn't run.
    if ((err as { code?: string }).code === '42P01') {
      const body: ActivitiesPage = {
        activities: [],
        page,
        pageSize,
        total: 0,
        totalPages: 1,
        sync: null,
      };
      return Response.json(body);
    }
    throw err;
  }
};

export const config: Config = {
  path: '/api/activities',
  method: 'GET',
};
