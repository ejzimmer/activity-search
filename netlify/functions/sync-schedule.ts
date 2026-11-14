import type { Config } from '@netlify/functions';
import { startBackgroundSync } from '../../lib/sync.ts';

export default async function startDailySync(): Promise<Response> {
  const apiKey = process.env.GARMIN_PERSONAL_API_KEY;
  const siteUrl = process.env.URL;
  if (!apiKey || !siteUrl) {
    console.error('GARMIN_PERSONAL_API_KEY or URL is not set; not syncing');
    return new Response(null, { status: 500 });
  }
  const response = await startBackgroundSync(siteUrl, apiKey);
  console.log(`Started sync: ${response.status}`);
  return new Response(null, { status: response.ok ? 202 : 502 });
}

// Garmin's Personal API can't notify us of new activities, so they only arrive
// by asking.
export const config: Config = {
  schedule: '@daily',
};
