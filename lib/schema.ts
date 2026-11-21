import type { Sql } from './db.ts';

/**
 * Start/end coordinates and the summary polyline are kept so PostGIS columns
 * can be derived from them later without re-syncing from Garmin.
 */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS activities (
    id                  BIGINT PRIMARY KEY,          -- Garmin Connect activityId
    name                TEXT NOT NULL,
    sport_type          TEXT,                         -- Garmin typeKey, e.g. running, cycling, hiking
    description         TEXT,
    location_name       TEXT,
    start_date          TIMESTAMPTZ NOT NULL,
    start_date_local    TIMESTAMP,                    -- wall-clock time where the activity happened
    distance_m          DOUBLE PRECISION,
    moving_time_s       INTEGER,
    elapsed_time_s      INTEGER,
    elevation_gain_m    DOUBLE PRECISION,
    average_speed_mps   DOUBLE PRECISION,
    max_speed_mps       DOUBLE PRECISION,
    average_heartrate   DOUBLE PRECISION,
    max_heartrate       DOUBLE PRECISION,
    calories            DOUBLE PRECISION,
    start_lat           DOUBLE PRECISION,
    start_lng           DOUBLE PRECISION,
    end_lat             DOUBLE PRECISION,
    end_lng             DOUBLE PRECISION,
    summary_polyline    TEXT,                         -- Google encoded polyline, simplified
    track_checked_at    TIMESTAMPTZ,                  -- when we last tried to read the activity file
    raw                 JSONB,                        -- the full Garmin summary, for anything we didn't map
    imported_at         TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS activities_start_date_idx ON activities (start_date DESC, id DESC)`,
  `CREATE TABLE IF NOT EXISTS favourite_locations (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    lat                 DOUBLE PRECISION NOT NULL,
    lng                 DOUBLE PRECISION NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE,         -- trimmed and lower-cased
    password_hash       TEXT NOT NULL,
    is_admin            BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_one_admin_idx ON users ((true)) WHERE is_admin`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash          TEXT PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
    expires_at          TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS invites (
    code_hash           TEXT PRIMARY KEY,
    created_by          INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
    expires_at          TIMESTAMPTZ NOT NULL,
    used_by             INTEGER REFERENCES users ON DELETE SET NULL,
    used_at             TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS sign_in_failures (
    email               TEXT NOT NULL,
    failed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS sign_in_failures_email_idx ON sign_in_failures (email, failed_at)`,
  // Rows synced before there were accounts have no user until the first account claims them.
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users ON DELETE CASCADE`,
  `CREATE INDEX IF NOT EXISTS activities_user_start_date_idx ON activities (user_id, start_date DESC, id DESC)`,
  `ALTER TABLE favourite_locations ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users ON DELETE CASCADE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_key_encrypted TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_key_saved_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_garmin_key_rejected BOOLEAN NOT NULL DEFAULT false`,
  `DROP TABLE IF EXISTS sync_state`,
  `CREATE TABLE IF NOT EXISTS user_sync_state (
    user_id             INTEGER PRIMARY KEY REFERENCES users ON DELETE CASCADE,
    locked_until        TIMESTAMPTZ,
    last_started_at     TIMESTAMPTZ,
    last_finished_at    TIMESTAMPTZ,
    last_result         TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    code_hash           TEXT PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
    expires_at          TIMESTAMPTZ NOT NULL,
    used_at             TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS password_reset_failures (
    failed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

export async function ensureSchema(sql: Sql) {
  for (const statement of SCHEMA) await sql.query(statement);
}
