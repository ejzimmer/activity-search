import polyline from '@mapbox/polyline';
import { describe, expect, it } from 'vitest';
import type { ActivityResponse } from '../lib/types.ts';
import { parseActivitiesPage } from '../src/parseActivitiesPage.ts';

const route: [number, number][] = [
  [-37.81, 144.96],
  [-37.82, 144.97],
];

function createActivityResponse(
  summaryPolyline: string | null,
  sportType: string,
): ActivityResponse {
  return {
    id: '1',
    name: 'Morning run',
    sport_type: sportType,
    start_date: '2026-11-20T00:30:00Z',
    distance_m: 5000,
    moving_time_s: 1500,
    elapsed_time_s: 1600,
    elevation_gain_m: 20,
    start_lat: -37.81,
    start_lng: 144.96,
    summary_polyline: summaryPolyline,
  };
}

function parseOneActivity(
  summaryPolyline: string | null,
  sportType = 'running',
) {
  const page = parseActivitiesPage({
    activities: [createActivityResponse(summaryPolyline, sportType)],
    page: 1,
    pageSize: 25,
    total: 1,
    totalPages: 1,
    sportTypes: [],
    sync: null,
  });
  return page.activities[0];
}

describe('parseActivitiesPage', () => {
  describe('for each activity', () => {
    it('parses the start date as an instant', () => {
      expect(
        parseOneActivity(null).start_date.equals(
          Temporal.Instant.from('2026-11-20T00:30:00Z'),
        ),
      ).toBe(true);
    });

    describe('when it has a route', () => {
      it('decodes the polyline into latitude and longitude pairs', () => {
        expect(parseOneActivity(polyline.encode(route)).route).toEqual(route);
      });
    });

    describe('when it is virtual', () => {
      it('has a null route, since its GPS is from a game world', () => {
        expect(
          parseOneActivity(polyline.encode(route), 'virtual_ride').route,
        ).toBeNull();
      });
    });

    describe('when it has no GPS', () => {
      it('has a null route', () => {
        expect(parseOneActivity(null).route).toBeNull();
      });
    });
  });
});
