/**
 * Minimal client for the Garmin Connect Personal API
 * (https://developer.garmin.com/gc-developer-program/personal/personal-faq/).
 *
 * Endpoints and auth follow Garmin's own reference client,
 * https://github.com/garmin/connect-personal-api-python.
 */

export const DEFAULT_BASE_URL = 'https://personal.connectapi.garmin.com';
const TOKEN_PATH =
  '/personalapitoken-service/personal-api/personal-api-key/token';

export class GarminApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    body: string,
  ) {
    super(
      `Garmin API ${status} for ${url}${body ? `: ${body.slice(0, 300)}` : ''}`,
    );
  }
}

export interface GarminClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Pause between requests, in ms. Garmin doesn't publish rate limits, so be gentle. */
  delayMs?: number;
  fetch?: typeof fetch;
}

const sleepFor = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GarminClient {
  private token: { value: string; expiresAt: Temporal.Instant } | null = null;
  private readonly baseUrl: string;
  private readonly delayMs: number;
  private readonly fetch: typeof fetch;

  constructor(private readonly options: GarminClientOptions) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.delayMs = options.delayMs ?? 250;
    this.fetch = options.fetch ?? fetch;
  }

  /** Swaps the personal API key for a bearer token (valid up to 24h; there are no refresh tokens). */
  private async getAccessToken(): Promise<string> {
    const refreshAfter = Temporal.Now.instant().add({ minutes: 5 });
    if (
      this.token &&
      Temporal.Instant.compare(this.token.expiresAt, refreshAfter) > 0
    )
      return this.token.value;
    const url = `${this.baseUrl}${TOKEN_PATH}`;
    const res = await this.fetch(url, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        Authorization: `ApiKey ${this.options.apiKey}`,
      },
    });
    if (!res.ok) throw new GarminApiError(res.status, url, await res.text());
    const value = (await res.text()).trim();
    this.token = {
      value,
      expiresAt:
        readJwtExpiry(value) ?? Temporal.Now.instant().add({ hours: 1 }),
    };
    return value;
  }

  private async getResponse(
    path: string,
    params: Record<string, string | number> = {},
    accept = 'application/json',
  ) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params))
      url.searchParams.set(k, String(v));

    for (let attempt = 0; ; attempt++) {
      if (this.delayMs) await sleepFor(this.delayMs);
      const res = await this.fetch(url, {
        headers: {
          Accept: accept,
          Authorization: `Bearer ${await this.getAccessToken()}`,
        },
      });
      if (res.ok) return res;
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleepFor(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 2000 * 2 ** attempt,
        );
        continue;
      }
      throw new GarminApiError(res.status, url.toString(), await res.text());
    }
  }

  /** Garmin returns newest first. Dates are calendar dates, YYYY-MM-DD. */
  async searchActivities(
    opts: {
      start?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    const params: Record<string, string | number> = {
      start: opts.start ?? 0,
      limit: opts.limit ?? 100,
    };
    if (opts.startDate) params.startDate = opts.startDate;
    if (opts.endDate) params.endDate = opts.endDate;
    const res = await this.getResponse(
      '/activitylist-service/activities/search/activities',
      params,
    );
    const text = await res.text();
    return (text ? JSON.parse(text) : []) as GarminActivity[];
  }

  /** The original activity file (usually FIT), wrapped in a ZIP. */
  async downloadActivity(activityId: string | number): Promise<Uint8Array> {
    const id = String(activityId);
    if (!/^[1-9]\d*$/.test(id)) throw new Error(`Invalid activity id: ${id}`);
    const res = await this.getResponse(
      `/download-service/files/activity/${id}`,
      {},
      'application/zip, application/x-zip-compressed, application/octet-stream',
    );
    return new Uint8Array(await res.arrayBuffer());
  }
}

function readJwtExpiry(token: string): Temporal.Instant | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
    return typeof payload.exp === 'number'
      ? Temporal.Instant.fromEpochMilliseconds(payload.exp * 1000)
      : null;
  } catch {
    return null;
  }
}

/** The fields we use from an activity search result. Garmin returns many more; they're kept in `raw`. */
export interface GarminActivity {
  activityId: number;
  activityName?: string | null;
  description?: string | null;
  startTimeGMT?: string | null; // "2024-03-04 20:12:45"
  startTimeLocal?: string | null;
  activityType?: { typeKey?: string | null } | null;
  distance?: number | null; // metres
  duration?: number | null; // seconds
  elapsedDuration?: number | null;
  movingDuration?: number | null;
  elevationGain?: number | null;
  averageSpeed?: number | null; // m/s
  maxSpeed?: number | null;
  averageHR?: number | null;
  maxHR?: number | null;
  calories?: number | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
  locationName?: string | null;
  [key: string]: unknown;
}

export interface ActivityRow {
  id: string;
  name: string;
  sport_type: string | null;
  description: string | null;
  location_name: string | null;
  start_date: string;
  start_date_local: string | null;
  distance_m: number | null;
  moving_time_s: number | null;
  elapsed_time_s: number | null;
  elevation_gain_m: number | null;
  average_speed_mps: number | null;
  max_speed_mps: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  calories: number | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  raw: GarminActivity;
}

/** Garmin's zoneless "YYYY-MM-DD HH:MM:SS" → Temporal.PlainDateTime. */
function parseGarminDateTime(value: string): Temporal.PlainDateTime {
  try {
    return Temporal.PlainDateTime.from(value.trim());
  } catch {
    throw new Error(`Unrecognised Garmin timestamp: "${value}"`);
  }
}

export function parseGarminGmt(value: string): string {
  return parseGarminDateTime(value)
    .toZonedDateTime('UTC')
    .toInstant()
    .toString();
}

export function parseGarminLocal(value: string): string {
  return parseGarminDateTime(value).toString();
}

const readFiniteNumber = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const readTrimmedText = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

/** Garmin reports 0,0 for activities without GPS, so treat that as no location. */
function parseCoordinates(
  rawLatitude: unknown,
  rawLongitude: unknown,
): [number | null, number | null] {
  const latitude = readFiniteNumber(rawLatitude);
  const longitude = readFiniteNumber(rawLongitude);
  if (latitude === null || longitude === null) return [null, null];
  if (latitude === 0 && longitude === 0) return [null, null];
  return [latitude, longitude];
}

export function createActivityRow(a: GarminActivity): ActivityRow {
  if (!a.activityId) throw new Error('Activity has no activityId');
  if (!a.startTimeGMT)
    throw new Error(`Activity ${a.activityId} has no startTimeGMT`);
  const [start_lat, start_lng] = parseCoordinates(
    a.startLatitude,
    a.startLongitude,
  );
  const [end_lat, end_lng] = parseCoordinates(a.endLatitude, a.endLongitude);
  const local = readTrimmedText(a.startTimeLocal);
  return {
    id: String(a.activityId),
    name: readTrimmedText(a.activityName) ?? 'Untitled activity',
    sport_type: readTrimmedText(a.activityType?.typeKey),
    description: readTrimmedText(a.description),
    location_name: readTrimmedText(a.locationName),
    start_date: parseGarminGmt(a.startTimeGMT),
    start_date_local: local ? parseGarminLocal(local) : null,
    distance_m: readFiniteNumber(a.distance),
    moving_time_s:
      readFiniteNumber(a.movingDuration) === null
        ? null
        : Math.round(a.movingDuration!),
    elapsed_time_s: (() => {
      const v =
        readFiniteNumber(a.elapsedDuration) ?? readFiniteNumber(a.duration);
      return v === null ? null : Math.round(v);
    })(),
    elevation_gain_m: readFiniteNumber(a.elevationGain),
    average_speed_mps: readFiniteNumber(a.averageSpeed),
    max_speed_mps: readFiniteNumber(a.maxSpeed),
    average_heartrate: readFiniteNumber(a.averageHR),
    max_heartrate: readFiniteNumber(a.maxHR),
    calories: readFiniteNumber(a.calories),
    start_lat,
    start_lng,
    end_lat,
    end_lng,
    raw: a,
  };
}
