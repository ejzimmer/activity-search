# Activity search

Search and map your Garmin activities. This first version pulls your activities
straight from Garmin Connect (no third party in between) into Postgres and shows
them in a paginated table.

- **Front end:** React + Vite (`src/`)
- **API:** a Netlify Function at `GET /api/activities?page=1&pageSize=25` (`netlify/functions/activities.ts`)
- **Data source:** the [Garmin Connect Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-faq/),
  via `npm run sync` (`scripts/sync-garmin.ts`)
- **Database:** Neon Postgres in Sydney, plain tables for now (`db/schema.sql`). Start/end
  coordinates and a simplified route polyline are stored already, so PostGIS and the map
  can be added later without re-syncing.

## One-time setup

### 1. Create a Garmin personal API key

Go to <https://connect.garmin.com/app/settings/personalApiToken> and create a key.
Pick the longest expiry you're comfortable with (up to a year). The key is shown
**once**, so copy it straight away. It's for your own data only.

### 2. Create the database in Sydney

1. Sign in at <https://console.neon.tech> and click **New project**.
2. Pick **AWS Asia Pacific (Sydney)** as the region. This can't be changed later.
3. Once it's created, click **Connect**, tick **Connection pooling**, and copy the connection string.
4. In this repo: `cp .env.example .env`, paste the string as `DATABASE_URL`, and paste
   your Garmin key as `GARMIN_PERSONAL_API_KEY`.

### 3. Create the tables and sync

```sh
npm install
npm run db:migrate
npm run sync
```

The first sync fetches every activity, then downloads each one's original file
(usually FIT) to get the route. That's one request per activity with a short pause
between them, so a few thousand activities takes a while. It's safe to stop and
re-run: activities are matched on their Garmin id and each file is only downloaded once.

After that, `npm run sync` only fetches activities from the last couple of days
before your newest one. Use `npm run sync -- --full` to refresh every summary.
Activities with no GPS (treadmill, gym) are stored without coordinates.

If the sync says Garmin rejected the key, it has probably expired: create a new
one and update `.env`.

### 4. Run it locally

```sh
npm install -g netlify-cli   # once
npm run dev                  # http://localhost:8888
```

### 5. Deploy to Netlify

1. In Netlify, **Add new project → Import an existing project** and choose this repo.
   The build settings come from `netlify.toml`.
2. **Project configuration → Environment variables:** add `DATABASE_URL` with the same
   connection string.
3. **Project configuration → Build & deploy → Functions region:** choose
   **Asia Pacific (Sydney)** so the API sits next to the database, then redeploy.

## Development

```sh
npm test          # unit tests (Garmin client, track parsing, pagination)
npm run typecheck
```
