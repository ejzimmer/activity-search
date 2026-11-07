-- v1 schema: plain Postgres, no PostGIS yet.
-- Start/end coordinates and the summary polyline are stored now so that
-- adding PostGIS later is a migration (ALTER TABLE ... ADD COLUMN geom ...;
-- UPDATE from these columns), not a re-import.

CREATE TABLE IF NOT EXISTS activities (
  id                  BIGINT PRIMARY KEY,          -- Strava activity id
  name                TEXT NOT NULL,
  sport_type          TEXT,                         -- e.g. Run, Ride, Hike
  description         TEXT,
  start_date          TIMESTAMPTZ NOT NULL,         -- UTC, from the export
  distance_m          DOUBLE PRECISION,
  moving_time_s       INTEGER,
  elapsed_time_s      INTEGER,
  elevation_gain_m    DOUBLE PRECISION,
  average_speed_mps   DOUBLE PRECISION,
  max_speed_mps       DOUBLE PRECISION,
  average_heartrate   DOUBLE PRECISION,
  max_heartrate       DOUBLE PRECISION,
  calories            DOUBLE PRECISION,
  commute             BOOLEAN NOT NULL DEFAULT FALSE,
  gear                TEXT,
  start_lat           DOUBLE PRECISION,
  start_lng           DOUBLE PRECISION,
  end_lat             DOUBLE PRECISION,
  end_lng             DOUBLE PRECISION,
  summary_polyline    TEXT,                         -- Google encoded polyline, simplified
  source_file         TEXT,                         -- path inside the export, e.g. activities/123.gpx
  raw                 JSONB,                        -- the original CSV row, for anything we didn't map
  imported_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_start_date_idx ON activities (start_date DESC, id DESC);
