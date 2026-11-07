# Activity mapper

Search and map your Strava activities. This first version loads your Strava bulk
export into Postgres and shows every activity in a paginated table.

- **Front end:** React + Vite (`src/`)
- **API:** a Netlify Function at `GET /api/activities?page=1&pageSize=25` (`netlify/functions/activities.ts`)
- **Database:** Neon Postgres in Sydney, plain tables for now (`db/schema.sql`). Start/end
  coordinates and a simplified route polyline are stored already, so PostGIS and the map
  can be added later without re-importing.

## One-time setup

### 1. Request your Strava export (do this first, it takes a while)

Go to <https://www.strava.com/athlete/delete_your_account> and click **Request your archive**
(despite the URL, this doesn't delete anything). Strava emails a download link, usually
within a few hours. Unzip it somewhere outside this repo. You should see `activities.csv`
and an `activities/` folder.

### 2. Create the database in Sydney

1. Sign in at <https://console.neon.tech> and click **New project**.
2. Pick **AWS Asia Pacific (Sydney)** as the region. This can't be changed later.
3. Once it's created, click **Connect**, tick **Connection pooling**, and copy the connection string.
4. In this repo: `cp .env.example .env` and paste the string as `DATABASE_URL`.

### 3. Create the tables and import

```sh
npm install
npm run db:migrate
npm run import -- ~/Downloads/export_12345678   # the unzipped export folder
```

The import is safe to re-run; activities are matched on their Strava id. Activities
with no GPS (treadmill, gym) are imported without coordinates.

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
npm test          # unit tests (CSV/track parsing, pagination)
npm run typecheck
```
