# Activity search

Search and map your Garmin activities. This first version pulls your activities
straight from Garmin Connect (no third party in between) into Postgres and shows
them in a paginated table.

- **Front end:** React + Vite (`src/`), hosted on Netlify. Netlify passes `/api/*`
  requests on to the API (`netlify.toml`).
- **API:** one [Neon Function](https://neon.com/docs/compute/functions/overview) in
  Singapore (`functions/api.ts`, configured in `neon.ts`):
  - `GET /activities?page=1&pageSize=25` returns a page of activities.
  - `POST /sync` syncs with Garmin (`lib/sync.ts`). Neon calls it once a day.
- **Data source:** the [Garmin Connect Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-faq/).
- **Database:** Neon Postgres in Sydney, in its own project, with plain tables for now
  (`lib/schema.ts`). The first sync creates the tables. Start and end coordinates and a
  simplified route polyline are already stored, so PostGIS and the map can be added
  later without re-syncing.
- **Deploys:** GitHub Actions deploys the function on every push to `main`
  (`.github/workflows/deploy-functions.yml`).

Neon Functions don't run in Sydney, so the function lives in a second Neon project in
Singapore and connects to the Sydney database.

## Setup (all in the browser)

### 1. Create a Garmin personal API key

Go to <https://connect.garmin.com/app/settings/personalApiToken> and create a key.
Pick the longest expiry you're comfortable with (up to a year). The key is shown
**once**, so copy it straight away. It's for your own data only.

### 2. The database in Sydney

In the [Neon console](https://console.neon.tech), open the **activity-search** project
(in AWS Asia Pacific (Sydney)). Click **Connect**, turn on **Connection pooling**, and
copy the connection string.

### 3. A Neon project in Singapore for the function

1. In the Neon console, click **New project**. Name it something like
   `activity-search-api` and pick **AWS Asia Pacific (Singapore)** as the region.
2. In that project's **Settings**, copy the **Project ID**.
3. Create a Neon API key under **API keys** in your account or organisation settings,
   and copy it.

### 4. Give GitHub the secrets

In this repo on GitHub, go to **Settings → Secrets and variables → Actions**.

1. On the **Secrets** tab, add three repository secrets:
   - `NEON_API_KEY`: the Neon API key
   - `ACTIVITIES_DATABASE_URL`: the Sydney connection string
   - `GARMIN_PERSONAL_API_KEY`: your Garmin key
2. On the **Variables** tab, add a repository variable `NEON_FUNCTIONS_PROJECT_ID`
   holding the Singapore project ID.

### 5. Deploy the function

Go to **Actions → Deploy functions → Run workflow**. When it finishes, the run's
summary shows the API's URL. If it differs from the one in `netlify.toml` (which
happens only if the Singapore project is replaced), update `netlify.toml` to match.

After this, every push to `main` deploys again on its own.

### 6. Deploy the front end on Netlify

At <https://app.netlify.com>, import this repo (**Add new project → Import an existing
project**), keeping the build settings from `netlify.toml`. The front end doesn't need
any environment variables.

### 7. Run the first sync

A sync runs once a day on its own. To start one now, go to **Actions → Sync now → Run
workflow**.

The first sync fetches every activity, then downloads each one's original file
(usually FIT) to get the route. Each run stops after about 12 minutes and starts the
next one straight away, so a long history fills in without waiting for the next
day. The bottom of the page shows when the last sync finished and what it did.
Activities with no GPS (treadmill, gym) are stored without coordinates. The function's
logs are in the Singapore project under **Functions**.

If the page says Garmin rejected the key, it has expired. Create a new one, update the
`GARMIN_PERSONAL_API_KEY` secret on GitHub, then run **Deploy functions** again.

## Development (needs a terminal)

```sh
npm install
cp .env.example .env     # then fill it in
npm run sync             # sync from your machine
npm run dev              # front end on http://localhost:5173, using ACTIVITIES_API_URL
npm test
npm run typecheck
```
