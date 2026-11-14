# Activity search

Search and map your Garmin activities. This first version pulls your activities
straight from Garmin Connect (no third party in between) into Postgres and shows
them in a paginated table.

- **Front end:** React + Vite (`src/`)
- **API:** a Netlify Function at `GET /api/activities?page=1&pageSize=25` (`netlify/functions/activities.ts`)
- **Data source:** the [Garmin Connect Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-faq/).
  Netlify syncs once a day (`netlify/functions/sync-schedule.ts` starts
  `netlify/functions/sync-garmin.ts`, which does the work in `lib/sync.ts`).
- **Database:** Neon Postgres in Sydney, plain tables for now (`lib/schema.ts`). The
  tables are created automatically by the first sync. Start/end coordinates and a
  simplified route polyline are stored already, so PostGIS and the map can be added
  later without re-syncing.

## Setup (all in the browser)

### 1. Create a Garmin personal API key

Go to <https://connect.garmin.com/app/settings/personalApiToken> and create a key.
Pick the longest expiry you're comfortable with (up to a year). The key is shown
**once**, so copy it straight away. It's for your own data only.

### 2. Create the database in Sydney

1. Sign in at <https://console.neon.tech> and click **New project**.
2. Pick **AWS Asia Pacific (Sydney)** as the region. This can't be changed later.
3. Once it's created, click **Connect**, turn on **Connection pooling**, and copy the
   connection string.

### 3. Deploy to Netlify

1. At <https://app.netlify.com>, click **Add new project → Import an existing project**,
   choose GitHub, then this repo. Keep the build settings it suggests (they come from
   `netlify.toml`) and deploy.
2. Go to **Project configuration → Environment variables** and add two variables.
   Tick "Contains secret values" for both.
   - `DATABASE_URL`: the Neon connection string
   - `GARMIN_PERSONAL_API_KEY`: your Garmin key
3. Go to **Deploys → Trigger deploy → Deploy project** so the functions pick up the variables.
4. Optional: if your plan offers it, set **Project configuration → Build & deploy →
   Functions region** to **Asia Pacific (Sydney)** so the API sits next to the
   database, then deploy again.

### 4. Run the first sync

A sync runs once a day on its own. To start one now, go to **Logs → Functions →
sync-schedule** and click **Run now**.

The first sync fetches every activity, then downloads each one's original file
(usually FIT) to get the route. Each run stops after about 12 minutes and starts the
next one straight away, so a long history fills in without waiting for the next
day. The bottom of the page shows when the last sync finished and what it did.
Activities with no GPS (treadmill, gym) are stored without coordinates.

If the page says Garmin rejected the key, it has expired: create a new one and
update `GARMIN_PERSONAL_API_KEY`, then trigger a deploy.

## Development (needs a terminal)

```sh
npm install
cp .env.example .env     # then fill in DATABASE_URL and GARMIN_PERSONAL_API_KEY
npm run sync             # sync from your machine instead of waiting for Netlify
npm run dev              # http://localhost:8888, needs `npm install -g netlify-cli`
npm test                 # unit tests (Garmin client, track parsing, pagination)
npm run typecheck
```
