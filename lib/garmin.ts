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

const sleepFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        Authorization: `ApiKey ${this.options.apiKey}`,
      },
    });
    if (!response.ok)
      throw new GarminApiError(response.status, url, await response.text());
    const value = (await response.text()).trim();
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
    for (const [name, value] of Object.entries(params))
      url.searchParams.set(name, String(value));

    for (let attempt = 0; ; attempt++) {
      if (this.delayMs) await sleepFor(this.delayMs);
      const response = await this.fetch(url, {
        headers: {
          Accept: accept,
          Authorization: `Bearer ${await this.getAccessToken()}`,
        },
      });
      if (response.ok) return response;
      if ((response.status === 429 || response.status >= 500) && attempt < 4) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await sleepFor(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 2000 * 2 ** attempt,
        );
        continue;
      }
      throw new GarminApiError(
        response.status,
        url.toString(),
        await response.text(),
      );
    }
  }

  /** Garmin returns newest first. Dates are calendar dates, YYYY-MM-DD. */
  async searchActivities(
    options: {
      start?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    const params: Record<string, string | number> = {
      start: options.start ?? 0,
      limit: options.limit ?? 100,
    };
    if (options.startDate) params.startDate = options.startDate;
    if (options.endDate) params.endDate = options.endDate;
    const response = await this.getResponse(
      '/activitylist-service/activities/search/activities',
      params,
    );
    const text = await response.text();
    return (text ? JSON.parse(text) : []) as GarminActivity[];
  }

  /** The original activity file (usually FIT), wrapped in a ZIP. */
  async downloadActivity(activityId: string | number): Promise<Uint8Array> {
    const id = String(activityId);
    if (!/^[1-9]\d*$/.test(id)) throw new Error(`Invalid activity id: ${id}`);
    const response = await this.getResponse(
      `/download-service/files/activity/${id}`,
      {},
      'application/zip, application/x-zip-compressed, application/octet-stream',
    );
    return new Uint8Array(await response.arrayBuffer());
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

const readFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const readTrimmedText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

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

export function createActivityRow(activity: GarminActivity): ActivityRow {
  if (!activity.activityId) throw new Error('Activity has no activityId');
  if (!activity.startTimeGMT)
    throw new Error(`Activity ${activity.activityId} has no startTimeGMT`);
  const [start_lat, start_lng] = parseCoordinates(
    activity.startLatitude,
    activity.startLongitude,
  );
  const [end_lat, end_lng] = parseCoordinates(
    activity.endLatitude,
    activity.endLongitude,
  );
  const local = readTrimmedText(activity.startTimeLocal);
  return {
    id: String(activity.activityId),
    name: readTrimmedText(activity.activityName) ?? 'Untitled activity',
    sport_type: readTrimmedText(activity.activityType?.typeKey),
    description: readTrimmedText(activity.description),
    location_name: readTrimmedText(activity.locationName),
    start_date: parseGarminGmt(activity.startTimeGMT),
    start_date_local: local ? parseGarminLocal(local) : null,
    distance_m: readFiniteNumber(activity.distance),
    moving_time_s:
      readFiniteNumber(activity.movingDuration) === null
        ? null
        : Math.round(activity.movingDuration!),
    elapsed_time_s: (() => {
      const seconds =
        readFiniteNumber(activity.elapsedDuration) ??
        readFiniteNumber(activity.duration);
      return seconds === null ? null : Math.round(seconds);
    })(),
    elevation_gain_m: readFiniteNumber(activity.elevationGain),
    average_speed_mps: readFiniteNumber(activity.averageSpeed),
    max_speed_mps: readFiniteNumber(activity.maxSpeed),
    average_heartrate: readFiniteNumber(activity.averageHR),
    max_heartrate: readFiniteNumber(activity.maxHR),
    calories: readFiniteNumber(activity.calories),
    start_lat,
    start_lng,
    end_lat,
    end_lng,
    raw: activity,
  };
}
