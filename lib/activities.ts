import { NEAR_RADIUS_M, type Coordinates } from './coordinates.ts';
import type { Sql } from './db.ts';
import { parseActivityFilters, type ActivityFilters } from './filters.ts';
import { parsePagination } from './pagination.ts';
import type { SignedInUser } from './sessions.ts';
import { listSportTypeOptions } from './sport-types.ts';
import type {
  ActivitiesPageResponse,
  ActivityResponse,
  SyncStatusResponse,
} from './types.ts';

const EARTH_RADIUS_M = 6371008.8;

type SqlFragment = ReturnType<Sql>;

function calculateHaversineMetres(
  sql: Sql,
  { lat, lng }: Coordinates,
  latColumn: SqlFragment,
  lngColumn: SqlFragment,
) {
  return sql`2 * ${EARTH_RADIUS_M}::float8 * asin(sqrt(
    power(sin(radians(${latColumn} - ${lat}::float8) / 2), 2)
    + cos(radians(${lat}::float8)) * cos(radians(${latColumn}))
      * power(sin(radians(${lngColumn} - ${lng}::float8) / 2), 2)
  ))`;
}

function createStartsOrEndsNearCondition(sql: Sql, point: Coordinates) {
  const startDistance = calculateHaversineMetres(
    sql,
    point,
    sql`start_lat`,
    sql`start_lng`,
  );
  const endDistance = calculateHaversineMetres(
    sql,
    point,
    sql`end_lat`,
    sql`end_lng`,
  );
  return sql`(${startDistance} <= ${NEAR_RADIUS_M} OR ${endDistance} <= ${NEAR_RADIUS_M})`;
}

function createFilterCondition(
  sql: Sql,
  user: SignedInUser,
  {
    sportTypes,
    namePattern,
    distanceRange,
    movingTimeRange,
    nearPoint,
  }: ActivityFilters,
) {
  const conditions = [sql`user_id = ${user.id}`];
  if (sportTypes) conditions.push(sql`sport_type = ANY(${sportTypes})`);
  if (namePattern) conditions.push(sql`name ILIKE ${namePattern}`);
  if (distanceRange)
    conditions.push(
      sql`distance_m BETWEEN ${distanceRange.min} AND ${distanceRange.max}`,
    );
  // moving_time_s is an integer column, so Postgres would read uncast
  // fractional bounds as integers and reject them.
  if (movingTimeRange)
    conditions.push(
      sql`moving_time_s BETWEEN ${movingTimeRange.min}::float8 AND ${movingTimeRange.max}::float8`,
    );
  if (nearPoint)
    conditions.push(createStartsOrEndsNearCondition(sql, nearPoint));
  return conditions.reduce(
    (combined, condition) => sql`${combined} AND ${condition}`,
  );
}

export async function getActivitiesPage(
  sql: Sql,
  request: Request,
  user: SignedInUser,
): Promise<Response> {
  const searchParams = new URL(request.url).searchParams;
  const { page, pageSize, offset } = parsePagination(searchParams);
  const filterCondition = createFilterCondition(
    sql,
    user,
    parseActivityFilters(searchParams),
  );

  try {
    const [rows, [{ count }], sportTypeRows, [sync]] = await Promise.all([
      sql`
        SELECT id::text, name, sport_type, start_date, distance_m, moving_time_s, elapsed_time_s,
               elevation_gain_m, start_lat, start_lng, summary_polyline
        FROM activities
        WHERE ${filterCondition}
        ORDER BY start_date DESC, id DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`SELECT count(*)::int AS count FROM activities WHERE ${filterCondition}`,
      sql`SELECT DISTINCT sport_type FROM activities WHERE user_id = ${user.id} AND sport_type IS NOT NULL`,
      // The sync still runs on one Garmin key, the admin's.
      sql`
        SELECT last_started_at, last_finished_at, last_result,
               coalesce(locked_until > now(), false) AS running
        FROM sync_state WHERE id = 1 AND ${user.isAdmin}
      `,
    ]);
    const total = count as number;
    const body: ActivitiesPageResponse = {
      activities: rows as ActivityResponse[],
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      sportTypes: listSportTypeOptions(
        sportTypeRows.map((row) => row.sport_type as string),
      ),
      sync: (sync as SyncStatusResponse | undefined) ?? null,
    };
    return Response.json(body);
  } catch (error) {
    // 42P01: the tables don't exist yet because the first sync hasn't run.
    if ((error as { code?: string }).code === '42P01') {
      const body: ActivitiesPageResponse = {
        activities: [],
        page,
        pageSize,
        total: 0,
        totalPages: 1,
        sportTypes: [],
        sync: null,
      };
      return Response.json(body);
    }
    throw error;
  }
}
