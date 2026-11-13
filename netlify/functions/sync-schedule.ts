import type { Config } from '@netlify/functions';
import { createSyncToken } from '../../lib/sync.ts';

export default async function startHourlySync(): Promise<Response> {
  const apiKey = process.env.GARMIN_PERSONAL_API_KEY;
  const siteUrl = process.env.URL;
  if (!apiKey || !siteUrl) {
    console.error('GARMIN_PERSONAL_API_KEY or URL is not set; not syncing');
    return new Response(null, { status: 500 });
  }
  const res = await fetch(`${siteUrl}/api/sync`, {
    method: 'POST',
    headers: { 'x-sync-token': createSyncToken(apiKey) },
  });
  console.log(`Started sync: ${res.status}`);
  return new Response(null, { status: res.ok ? 202 : 502 });
}

export const config: Config = {
  schedule: '@hourly',
};
