import { startBackgroundSync } from '../lib/sync.ts';

const apiUrl = process.argv[2]?.replace(/\/$/, '');
const apiKey = process.env.GARMIN_PERSONAL_API_KEY;
if (!apiUrl || !apiKey) {
  console.error(
    'Usage: GARMIN_PERSONAL_API_KEY=... tsx scripts/start-sync.ts <api url>',
  );
  process.exit(1);
}

const response = await startBackgroundSync(apiUrl, apiKey);
console.log(`Sync request answered ${response.status}`);
if (!response.ok) process.exit(1);
