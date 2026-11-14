import { describe, expect, it, vi } from 'vitest';
import {
  GarminApiError,
  GarminClient,
  parseGarminGmt,
  createActivityRow,
  type GarminActivity,
} from '../lib/garmin.ts';

describe('parseGarminGmt', () => {
  describe('given a Garmin timestamp', () => {
    it('reads it as UTC', () => {
      expect(parseGarminGmt('2024-03-04 20:12:45')).toBe(
        '2024-03-04T20:12:45Z',
      );
      expect(parseGarminGmt('2024-03-04T20:12:45.0')).toBe(
        '2024-03-04T20:12:45Z',
      );
    });
  });

  describe('given something that is not a real date and time', () => {
    it('throws', () => {
      expect(() => parseGarminGmt('Mar 4, 2024')).toThrow(/Unrecognised/);
      expect(() => parseGarminGmt('2024-02-30 10:00:00')).toThrow(
        /Unrecognised/,
      );
    });
  });
});

describe('createActivityRow', () => {
  const activity: GarminActivity = {
    activityId: 17234567890,
    activityName: 'Sydney Running',
    description: null,
    startTimeGMT: '2024-03-04 20:12:45',
    startTimeLocal: '2024-03-05 07:12:45',
    activityType: { typeKey: 'running' },
    distance: 5230.4,
    duration: 1900.2,
    elapsedDuration: 1950.7,
    movingDuration: 1800.4,
    elevationGain: 48.2,
    averageSpeed: 2.9,
    maxSpeed: 4.5,
    averageHR: 152,
    maxHR: 171,
    calories: 410,
    startLatitude: -33.8688,
    startLongitude: 151.2093,
    endLatitude: -33.87,
    endLongitude: 151.211,
    locationName: 'Sydney',
    someFieldWeDontMap: 1,
  };

  describe('for an outdoor activity', () => {
    it('maps the summary fields', () => {
      expect(createActivityRow(activity)).toMatchObject({
        id: '17234567890',
        name: 'Sydney Running',
        sport_type: 'running',
        description: null,
        location_name: 'Sydney',
        start_date: '2024-03-04T20:12:45Z',
        start_date_local: '2024-03-05T07:12:45',
        distance_m: 5230.4,
        moving_time_s: 1800,
        elapsed_time_s: 1951,
        elevation_gain_m: 48.2,
        average_heartrate: 152,
        start_lat: -33.8688,
        end_lng: 151.211,
        raw: activity,
      });
    });
  });

  describe('for an indoor activity with missing fields', () => {
    it('leaves the location and missing values empty', () => {
      const row = createActivityRow({
        activityId: 1,
        startTimeGMT: '2024-01-01 00:00:00',
        startLatitude: 0,
        startLongitude: 0,
      });
      expect(row).toMatchObject({
        name: 'Untitled activity',
        start_lat: null,
        start_lng: null,
        distance_m: null,
        elapsed_time_s: null,
      });
    });
  });

  describe('without a start time', () => {
    it('throws', () => {
      expect(() => createActivityRow({ activityId: 1 })).toThrow(
        /startTimeGMT/,
      );
    });
  });
});

describe('GarminClient', () => {
  const createJwt = (exp: number) =>
    [
      'x',
      Buffer.from(JSON.stringify({ exp })).toString('base64url'),
      'sig',
    ].join('.');

  function createFakeFetch(
    responses: Array<(url: string, init: RequestInit) => Response>,
  ) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = vi.fn(
      async (url: string | URL, init: RequestInit = {}) => {
        calls.push({ url: String(url), init });
        const next = responses.shift();
        if (!next) throw new Error(`Unexpected request to ${url}`);
        return next(String(url), init);
      },
    );
    return { fetch: fakeFetch as unknown as typeof fetch, calls };
  }

  describe('searchActivities', () => {
    describe('when called more than once', () => {
      it('exchanges the API key for a bearer token only once', async () => {
        const token = createJwt(Date.now() / 1000 + 86_400);
        const { fetch, calls } = createFakeFetch([
          () => new Response(token),
          () => Response.json([{ activityId: 1 }]),
          () => Response.json([]),
        ]);
        const client = new GarminClient({
          apiKey: 'k3y',
          baseUrl: 'https://garmin.test',
          delayMs: 0,
          fetch,
        });
        expect(
          await client.searchActivities({
            start: 0,
            limit: 100,
            startDate: '2024-01-01',
          }),
        ).toEqual([{ activityId: 1 }]);
        expect(await client.searchActivities({ start: 100 })).toEqual([]);

        expect(calls[0].url).toBe(
          'https://garmin.test/personalapitoken-service/personal-api/personal-api-key/token',
        );
        expect(calls[0].init).toMatchObject({
          method: 'POST',
          headers: { Authorization: 'ApiKey k3y' },
        });
        expect(calls[1].url).toBe(
          'https://garmin.test/activitylist-service/activities/search/activities?start=0&limit=100&startDate=2024-01-01',
        );
        expect(calls[1].init.headers).toMatchObject({
          Authorization: `Bearer ${token}`,
        });
        expect(calls).toHaveLength(3);
      });
    });

    describe('when Garmin rejects the API key', () => {
      it('throws a GarminApiError', async () => {
        const { fetch } = createFakeFetch([
          () => new Response('bad key', { status: 401 }),
        ]);
        const client = new GarminClient({
          apiKey: 'k',
          baseUrl: 'https://garmin.test',
          delayMs: 0,
          fetch,
        });
        await expect(client.searchActivities()).rejects.toBeInstanceOf(
          GarminApiError,
        );
      });
    });
  });

  describe('downloadActivity', () => {
    describe('when rate limited', () => {
      it('retries and returns the file', async () => {
        const { fetch, calls } = createFakeFetch([
          () => new Response(createJwt(Date.now() / 1000 + 86_400)),
          () =>
            new Response('slow down', {
              status: 429,
              headers: { 'retry-after': '0.01' },
            }),
          () => new Response(new Uint8Array([1, 2, 3])),
        ]);
        const client = new GarminClient({
          apiKey: 'k',
          baseUrl: 'https://garmin.test',
          delayMs: 0,
          fetch,
        });
        expect(await client.downloadActivity(42)).toEqual(
          new Uint8Array([1, 2, 3]),
        );
        expect(calls[2].url).toBe(
          'https://garmin.test/download-service/files/activity/42',
        );
      });
    });

    describe('given an id that is not a plain number', () => {
      it('refuses it', async () => {
        const client = new GarminClient({
          apiKey: 'k',
          delayMs: 0,
          fetch: vi.fn() as unknown as typeof fetch,
        });
        await expect(client.downloadActivity('../etc')).rejects.toThrow(
          /Invalid activity id/,
        );
      });
    });
  });
});
