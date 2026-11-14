import type { Config } from '@netlify/functions';
import { createSyncToken } from '../../lib/sync.ts';

export default async function startHourlySync(): Promise<Response> {
  const apiKey = process.env.GARMIN_PERSONAL_API_KEY;
  const siteUrl = process.env.URL;
  if (!apiKey || !siteUrl) {
    console.error('GARMIN_PERSONAL_API_KEY or URL is not set; not syncing');
    return new Response(null, { status: 500 });
  }
  const response = await fetch(`${siteUrl}/api/sync`, {
    method: 'POST',
    headers: { 'x-sync-token': createSyncToken(apiKey) },
  });
  console.log(`Started sync: ${response.status}`);
  return new Response(null, { status: response.ok ? 202 : 502 });
}

// Garmin's Personal API can't notify us of new activities, so they only arrive
// by asking. Each run is also capped at 12 minutes, so the first sync of a
// long history finishes over several runs.
export const config: Config = {
  schedule: '@hourly',
};
