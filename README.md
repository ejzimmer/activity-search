# Activity search

Search and map your Garmin activities. Each person signs in, adds their own Garmin
key, and the app pulls their activities straight from Garmin Connect (no third party
in between) into Postgres. Each person only sees their own activities.

- **Front end:** React + Vite (`src/`), hosted on Netlify. Netlify passes `/api/*`
  requests on to the API (`netlify.toml`).
- **API:** one [Neon Function](https://neon.com/docs/compute/functions/overview) in
  Singapore (`functions/api.ts`, configured in `neon.ts`):
  - `GET /activities?page=1&pageSize=25` returns a page of the signed-in person's
    activities. Routes are listed in `lib/api-routes.ts`.
  - `POST /sync` syncs with Garmin (`lib/sync.ts`). Neon calls it once a day, and it
    starts a sync for everyone with a Garmin key.
- **Data source:** the [Garmin Connect Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-faq/).
- **Database:** Neon Postgres in Sydney, in its own project, with plain tables for now
  (`lib/schema.ts`). Each deploy creates or updates the tables. Start and end coordinates and a
  simplified route polyline are already stored, so PostGIS and the map can be added
  later without re-syncing.
- **Deploys:** GitHub Actions deploys the function on every push to `main`
  (`.github/workflows/deploy-functions.yml`).

Neon Functions don't run in Sydney, so the function lives in a second Neon project in
Singapore and connects to the Sydney database.

## Setup (all in the browser)

### 1. The database in Sydney

In the [Neon console](https://console.neon.tech), open the **activity-search** project
(in AWS Asia Pacific (Sydney)). Click **Connect**, turn on **Connection pooling**, and
copy the connection string.

### 2. A Neon project in Singapore for the function

1. In the Neon console, click **New project**. Name it something like
   `activity-search-api` and pick **AWS Asia Pacific (Singapore)** as the region.
2. In that project's **Settings**, copy the **Project ID**.
3. Create a Neon API key under **API keys** in your account or organisation settings,
   and copy it.

### 3. Give GitHub the secrets

In this repo on GitHub, go to **Settings → Secrets and variables → Actions**.

1. On the **Secrets** tab, add four repository secrets:
   - `NEON_API_KEY`: the Neon API key
   - `ACTIVITIES_DATABASE_URL`: the Sydney connection string
   - `GARMIN_KEY_ENCRYPTION_SECRET`: a long random password (from a password
     manager's generator), used to encrypt everyone's Garmin keys. Changing it makes
     the saved keys unreadable, so everyone would have to add theirs again.
   - `SETUP_INVITE_CODE`: a long phrase you make up, used once to create the first
     account
2. On the **Variables** tab, add a repository variable `NEON_FUNCTIONS_PROJECT_ID`
   holding the Singapore project ID.

### 4. Deploy the function

Go to **Actions → Deploy functions → Run workflow**. When it finishes, the run's
summary shows the API's URL. If it differs from the one in `netlify.toml` (which
happens only if the Singapore project is replaced), update `netlify.toml` to match.

After this, every push to `main` deploys again on its own.

### 5. Deploy the front end on Netlify

At <https://app.netlify.com>, import this repo (**Add new project → Import an existing
project**), keeping the build settings from `netlify.toml`. The front end doesn't need
any environment variables.

### 6. Create your account

Open the site, choose **Create an account**, and enter `SETUP_INVITE_CODE` as the
invite code. It only works while there are no accounts. That first account is the
admin: it gets every activity synced so far, and it can invite other people with
**Invite someone**, which makes a link that works once, for seven days. Each person
only sees their own activities and favourite places.

### 7. Add your Garmin key

Each person creates their own key at
<https://connect.garmin.com/app/settings/personalApiToken>, picking the longest expiry
they're comfortable with (up to a year). Garmin shows it **once**. In the app, open
**Garmin key**, paste it in and save. The app checks the key with Garmin, stores it
encrypted, and starts the first sync.

The first sync fetches every activity, then downloads each one's original file
(usually FIT) to get the route. Each run stops after about 12 minutes and starts the
next one straight away, so a long history fills in without waiting for the next
day. After that, everyone syncs once a day, and **Sync now** at the bottom of the page
starts one straight away. Activities with no GPS (treadmill, gym) are stored without
coordinates. The function's logs are in the Singapore project under **Functions**.

When a key expires, Garmin rejects it, the daily sync skips that person, and the app
asks them for a new key.

## Development (needs a terminal)

```sh
npm install
cp .env.example .env     # then fill it in
npm run dev              # front end on http://localhost:5173, using ACTIVITIES_API_URL
npm test
npm run typecheck
```
