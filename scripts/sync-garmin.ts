import 'dotenv/config';
import { connectToDatabase } from '../lib/db.ts';
import { GarminClient } from '../lib/garmin.ts';
import { syncWithGarmin } from '../lib/sync.ts';

const apiKey = process.env.GARMIN_PERSONAL_API_KEY;
if (!apiKey) {
  console.error('Set GARMIN_PERSONAL_API_KEY in .env (see README).');
  process.exit(1);
}

await syncWithGarmin({
  sql: connectToDatabase(),
  garmin: new GarminClient({
    apiKey,
    baseUrl: process.env.GARMIN_PERSONAL_API_BASE_URL,
  }),
  full: process.argv.includes('--full'),
});
